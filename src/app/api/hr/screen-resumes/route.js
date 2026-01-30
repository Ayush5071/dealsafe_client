import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { extractTextFromPDF } from '@/lib/pdfParser';
import { ollamaClient } from '@/lib/llm';
import { getToken } from 'next-auth/jwt';
import { getUserRoleByEmail } from '@/lib/db';

const ALLOWED = ['HR Professional', 'Recruiter'];

export async function POST(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const role = await getUserRoleByEmail(token.email);
    if (!role || !ALLOWED.includes(role)) return NextResponse.json({ error: 'Forbidden: HR access required' }, { status: 403 });

    const form = await req.formData();
    const jd = form.get('jd')?.toString();
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
        const resumeText = await extractTextFromPDF(filePath);

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

        results.push(parsed);
      } finally {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error('Screen resumes error', err);
    return NextResponse.json({ error: err?.message || 'Failed to screen resumes' }, { status: 500 });
  }
}