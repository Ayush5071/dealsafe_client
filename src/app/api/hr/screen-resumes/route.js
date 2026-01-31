import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { extractTextFromPDF } from '@/lib/pdfParser';
import { ollamaClient } from '@/lib/llm';
import { getToken } from 'next-auth/jwt';
import { getUserRoleByEmail, ensureAdminSetup } from '@/lib/db';
import { connectMongoose } from '@/lib/mongoose';
import Feedback from '@/lib/models/Feedback';
import { getServerSession } from 'next-auth';
import { submitForExpertReview } from '@/lib/hilOrchestrator';

const ALLOWED = ['HR Professional', 'Recruiter'];

export async function POST(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const role = await getUserRoleByEmail(token.email);
    if (!role || !ALLOWED.includes(role)) return NextResponse.json({ error: 'Forbidden: HR access required' }, { status: 403 });

    const form = await req.formData();
    const jd = form.get('jd')?.toString();
    const topN = parseInt(form.get('topN')?.toString() || '0', 10) || 0;
    const useQwen = (form.get('useQwen') === 'true' || form.get('useQwen') === '1');
    const checkFormatting = (form.get('checkFormatting') === 'true' || form.get('checkFormatting') === '1');
    const extractForm = (form.get('extractForm') === 'true' || form.get('extractForm') === '1');

    if (!jd) return NextResponse.json({ error: 'Job description is required' }, { status: 400 });

    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const resumeFiles = form.getAll('resumes');
    if (!resumeFiles || resumeFiles.length === 0) return NextResponse.json({ error: 'At least one resume is required' }, { status: 400 });

    const saveFile = async (file, suffix) => {
      const name = `${Date.now()}-${suffix}.pdf`;
      const filePath = path.join(uploadsDir, name);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      return filePath;
    };

    const results = [];

    for (let i = 0; i < resumeFiles.length; i++) {
      const file = resumeFiles[i];
      const filePath = await saveFile(file, `resume-${i}`);
      try {
        // Normalize PDF extraction output to string (some extractors return { text, numPages })
        const rawExtract = await extractTextFromPDF(filePath);
        const resumeText = typeof rawExtract === 'string' ? rawExtract : (rawExtract?.text || rawExtract?.fullText || '');

        // Build prompt for Qwen
        const systemPrompt = `You are an experienced recruiter in India. Compare the resume to the provided job description and return a JSON object with keys: name, score (0-100), match_percentage (0-100), pros:[], cons:[], highlights:[], suggestion (short string). Only return a JSON object.`;
        const userContent = `JOB DESCRIPTION:\n${jd}\n\nRESUME:\n${resumeText}\n\nReturn only a single JSON object.`;

        let responseText = null;
        try {
          const res = await ollamaClient.chat([{ role: 'user', content: userContent }], systemPrompt);
          responseText = res;
        } catch (err) {
          console.warn('Ollama resume screening failed, using heuristic fallback:', err?.message || err);
        }

        let parsed = null;
        if (responseText) {
          try {
            const m = responseText.match(/\{[\s\S]*\}/);
            if (m) parsed = JSON.parse(m[0]);
          } catch (err) {
            console.warn('Failed to parse Ollama JSON, will fallback to heuristic', err);
          }
        }

        if (!parsed) {
          // Heuristic fallback: simple keyword match
          const jdTerms = jd.split(/[^A-Za-z0-9]+/).filter(Boolean).map(s => s.toLowerCase()).filter(s => s.length > 3);
          const resumeTerms = resumeText.split(/[^A-Za-z0-9]+/).filter(Boolean).map(s => s.toLowerCase());
          const matched = jdTerms.filter(t => resumeTerms.includes(t));
          const matchPerc = jdTerms.length ? Math.round((matched.length / jdTerms.length) * 100) : 0;
          const score = Math.round(matchPerc);

          parsed = {
            name: file.name || `Resume ${i + 1}`,
            score,
            match_percentage: matchPerc,
            pros: matched.slice(0, 10).map(t => `${t}`),
            cons: jdTerms.length && matchPerc < 50 ? ['Low match to JD keywords'] : [],
            highlights: matched.slice(0, 10),
            suggestion: matchPerc >= 70 ? 'Good match' : (matchPerc >= 40 ? 'Consider interviewing' : 'Low fit'),
          };
        }

        // Extract simple form fields (email/phone) if requested
        if (extractForm) {
          try {
            const emailMatch = resumeText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
            const phoneMatch = resumeText.match(/(\+?\d[\d\s-]{7,}\d)/);
            parsed.fields = {
              email: emailMatch ? (emailMatch[0] || null) : null,
              phone: phoneMatch ? (phoneMatch[0] || null) : null
            };
          } catch (e) {
            parsed.fields = {};
          }
        }

        // Formatting checks
        if (checkFormatting) {
          const length = (resumeText || '').length;
          const sections = (resumeText.match(/\n\s*\n/g) || []).length;
          parsed.formatting = {
            length,
            sections,
            has_experience_section: /experience|work history|professional experience/i.test(resumeText),
            has_education_section: /education|degree|university|college/i.test(resumeText)
          };
          if (!parsed.formatting.has_experience_section) parsed.cons = (parsed.cons || []).concat(['Missing experience section']);
        }

        results.push(parsed);

        // HIL is OPTIONAL: only submit if form field 'useHIL' is present or header set
        try {
          const useHIL = (form && typeof form.get === 'function' && (form.get('useHIL') === 'true' || form.get('useHIL') === '1')) || (req.headers?.get('x-use-hil') === 'true');
          if (useHIL) {
            const session = await getServerSession();
            const userEmail = session?.user?.email || token?.email || 'system@local';
            const hilResult = await submitForExpertReview(parsed, userEmail, 'resume', {
              documentName: file.name || `resume_${i}`,
              jd,
              resumeText: resumeText,
              user_role: role
            });

            // Attach HIL tracking info to parsed result
            parsed.hil_mandatory = true;
            parsed.hil_id = hilResult.hil_id;
            parsed.hil_status = hilResult.status;
            parsed.hil_message = hilResult.message;
          } else {
            // Non-blocking: create pending feedback for later review
            try {
              await connectMongoose();
              const defaultAdmin = (process.env.DEFAULT_ADMIN_EMAILS || 'ayusht5071@gmail.com').split(',')[0].trim().toLowerCase();
              await ensureAdminSetup(defaultAdmin);
              const fb = new Feedback({
                analysisId: `resume_${Date.now()}_${i}`,
                type: 'resume',
                documentName: file.name || `resume_${i}`,
                userEmail: session?.user?.email || token?.email || 'system@local',
                expertEmail: defaultAdmin,
                originalAnalysis: parsed,
                payload: { jd, resumeText: resumeText },
                status: 'pending'
              });
              await fb.save();
              try {
                const { storeFeedbackEmbedding } = await import('@/lib/feedbackEmbeddings');
                storeFeedbackEmbedding(fb).catch((e) => console.warn('storeFeedbackEmbedding error:', e));
              } catch (e) {
                console.warn('Failed to queue resume feedback embedding:', e?.message || e);
              }
            } catch (e) {
              console.warn('Failed to create non-blocking resume feedback entry:', e?.message || e);
            }
          }
        } catch (e) {
          console.warn('Failed to process HIL for resume screening:', e?.message || e);
        } finally {
          try { fs.unlinkSync(filePath); } catch (e) {}
        }
      } catch (err) {
        console.error('Error processing resume:', err);
      }
    }

    // If Qwen ranking requested and topN specified, call model to shortlist top candidates
    let shortlist = null;
    if (useQwen && topN > 0 && results.length > 0) {
      try {
        const summaryList = results.map((r, idx) => ({ idx, name: r.name || `Candidate ${idx+1}`, score: r.score || 0, highlights: r.highlights || [], suggestion: r.suggestion || '' }));
        const candidateText = summaryList.map(s => `CANDIDATE ${s.idx}: Name: ${s.name}\nScore: ${s.score}\nHighlights: ${s.highlights.join(', ')}\nSuggestion: ${s.suggestion}\n`).join('\n\n');
        const systemPrompt = `You are a seasoned recruiter. Given the JOB DESCRIPTION and the summarized candidate snippets, select the best ${topN} candidates and return a JSON object: { top: [{ name, idx, rank_reason }], reasons: [] }. Return only JSON.`;
        const userContent = `JOB DESCRIPTION:\n${jd}\n\nCANDIDATE_SUMMARIES:\n${candidateText}\n\nReturn only JSON with the top ${topN} candidates.`;

        const qwenRes = await ollamaClient.chat([{ role: 'user', content: userContent }], systemPrompt);
        const m = qwenRes && qwenRes.match(/\{[\s\S]*\}/);
        if (m) shortlist = JSON.parse(m[0]);
      } catch (e) {
        console.warn('Qwen ranking failed:', e?.message || e);
      }
    }

    return NextResponse.json({ results, shortlist });
  } catch (err) {
    console.error('Screen resumes error', err);
    return NextResponse.json({ error: err?.message || 'Failed to screen resumes' }, { status: 500 });
  }
}