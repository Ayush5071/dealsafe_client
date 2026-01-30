import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { extractTextFromPDF } from '@/lib/pdfParser';
import { ollamaClient, geminiClient } from '@/lib/llm';
import { ContractAnalysisSchema } from '@/lib/schemas';
import { getToken } from 'next-auth/jwt';
import { getUserRoleByEmail, getUserProfile } from '@/lib/db';
import { authOptions } from '../auth/[...nextauth]/route';

export async function POST(req) {
  try {
    const form = await req.formData();

    const fileA = form.get('offerA');
    const fileB = form.get('offerB');

    if (!fileA || !fileB) {
      return NextResponse.json({ error: 'Both offerA and offerB PDF files are required' }, { status: 400 });
    }

    // Save temporarily
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const saveFile = async (file, suffix) => {
      const arrayBuffer = file.stream ? file.stream() : null; // in case of native streams
      const name = `${Date.now()}-${suffix}.pdf`;
      const filePath = path.join(uploadsDir, name);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      return filePath;
    };

    const filePathA = await saveFile(fileA, 'offerA');
    const filePathB = await saveFile(fileB, 'offerB');

    try {
      const textA = await extractTextFromPDF(filePathA);
      const textB = await extractTextFromPDF(filePathB);

      // Primary: Qwen via Ollama
      // Authenticate: require logged-in user and retrieve role from DB
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      if (!token?.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      const userRole = await getUserRoleByEmail(token.email);
      if (!userRole) return NextResponse.json({ error: 'User role not found' }, { status: 403 });

      // Fetch user profile to include context in analysis
      const userProfile = await getUserProfile(token.email);

      // Build profile context string
      let profileContext = '';
      if (userProfile) {
        if (userRole === 'Freelancer') {
          profileContext = `User Profile Context: Freelancer with ${userProfile.yearsExperience || '0'} years of experience, completed ${userProfile.projectsCompleted || '0'} projects, total earnings: ₹${userProfile.totalEarnings || '0'}. Projects: ${userProfile.projectsDescription || 'No projects listed'}. ${userProfile.projectsCompleted == 0 ? 'NOTE: User is just starting out and may prioritize gaining experience over higher pay or strict terms.' : ''}`;
        } else if (userRole === 'Corporate Employee') {
          profileContext = `User Profile Context: Corporate Employee with ${userProfile.yearsExperience || '0'} years of experience, current salary: ₹${userProfile.currentSalary || 'N/A'}/year, tech stack: ${userProfile.techStack || 'Not specified'}, current company: ${userProfile.currentCompany || 'Not specified'}, previous companies: ${userProfile.previousCompanies || 'Not specified'}. Consider career growth, skill match, and compensation relative to current salary.`;
        }
        // Add similar blocks for Agency, Employer, etc. if needed
      }

      // Role-specific instructions to favor the user's interests per role
      const roleInstructionsMap = {
        Freelancer: "Prioritize payment security, clear milestone definitions, enforceable late fees, IP ownership protections favoring the freelancer, termination fairness, and suggest freelancer-friendly alternative clauses for negotiation.",
        Agency: "Focus on SLAs, deliverable clarity, client liability limits, indemnity and IP transfer terms, team-substitution rights, and secure payment structures.",
        'Corporate Employee': "Emphasize notice period fairness, probation safeguards, salary protection, legality of non-compete (note Section 27 issues), and termination safeguards under Indian labour law.",
        Employer: "Help draft enforceable confidentiality, termination, and misconduct clauses while remaining compliant with Indian labour laws and advise on balanced IP ownership and indemnity terms.",
        'Startup Founder': "Balance flexibility and founder protections: ESOP/vesting clarity, founder exit clauses, confidentiality, and contractor vs employee classification risks.",
        'HR Professional': "Focus on compliance, policy clarity, dispute avoidance, and drafting offer letters that align with Indian labour regulations and best practices.",
      };

      const roleInstruction = roleInstructionsMap[userRole] || "Focus on the user's interest and highlight negotiation points and legal risks under Indian law.";

      const basePrompt = `You are an experienced Indian employment lawyer advising a user with role: ${userRole}. ${profileContext ? profileContext + '\n\n' : ''}Always provide guidance strictly under Indian law (Indian Contract Act, 1872; Information Technology Act, 2000; applicable labour laws; Shops & Establishments Acts; Industrial Disputes Act; Companies Act, 2013). Favor the user's interests given their role. ${roleInstruction} Explain pros and cons for each offer, list specific points to negotiate, and identify legal risks (India-focused). For each concerning clause, extract the exact clause text verbatim from the provided documents (include a short context label like 'Section heading or surrounding line') and return it in the \`extracted_clauses\` array for that offer. Provide a clear recommendation on which offer to accept with a brief reason and a confidence score (0-100). Output a strict JSON object with keys: offerA: {pros:[], cons:[], extracted_clauses:[]}, offerB:{pros:[], cons:[], extracted_clauses:[]}, recommendation:{which:string, reason:string, confidence:number}. If the analysis requires a foreign jurisdiction, respond exactly: "This assistant provides guidance strictly under Indian law only." Do NOT mention storage, embeddings, database, or internal system details. Keep answers concise and role-focused.`;

      const systemPrompt = basePrompt;

      const userContent = `OFFER A:\n${textA}\n\nOFFER B:\n${textB}\n\nReturn only valid JSON as described.`;

      let responseText = null;
      try {
        const res = await ollamaClient.chat([{ role: 'user', content: userContent }], systemPrompt);
        responseText = res;
      } catch (err) {
        console.warn('Ollama compare failed, falling back to Gemini:', err?.message || err);
      }

      // Fallback: use Gemini to analyze individually and synthesize
      let analysis = null;
      if (!responseText) {
        const analyses = {};
        try {
          const a = await geminiClient.analyzeContract(textA, ContractAnalysisSchema);
          const b = await geminiClient.analyzeContract(textB, ContractAnalysisSchema);
          analyses.offerA = a;
          analyses.offerB = b;

          // Simple heuristic to synthesize pros/cons and recommendation
          const getProsCons = (analysis) => {
            const pros = [];
            const cons = [];
            (analysis.clauses || []).forEach((c) => {
              if (c.risk_level === 'low') pros.push(`${c.clause_name}: ${c.description}`);
              if (c.risk_level === 'high' || c.risk_level === 'critical') cons.push(`${c.clause_name}: ${c.description}`);
            });
            return { pros, cons };
          };

          const aPC = getProsCons(a);
          const bPC = getProsCons(b);

          const recommendation = a.final_score <= b.final_score ? { which: 'Offer A', reason: 'Lower risk score', confidence: Math.min(95, Math.round((b.final_score - a.final_score) + 50)) } : { which: 'Offer B', reason: 'Lower risk score', confidence: Math.min(95, Math.round((a.final_score - b.final_score) + 50)) };

          const body = {
            offerA: { pros: aPC.pros.slice(0, 6), cons: aPC.cons.slice(0, 6) },
            offerB: { pros: bPC.pros.slice(0, 6), cons: bPC.cons.slice(0, 6) },
            recommendation,
            analysis: analyses,
          };

          return NextResponse.json(body);
        } catch (err) {
          console.error('Gemini fallback failed:', err);
          return NextResponse.json({ error: 'Both Qwen and Gemini failed to analyze the offers' }, { status: 500 });
        }
      }

      // Try parse Ollama response (JSON)
      let parsed = null;
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch (err) {
        console.warn('Failed to parse Ollama JSON, returning raw text', err);
      }

      const ret = {
        offerA: parsed?.offerA || { pros: [], cons: [] },
        offerB: parsed?.offerB || { pros: [], cons: [] },
        recommendation: parsed?.recommendation || { which: 'Unknown', reason: responseText || 'Could not parse', confidence: 0 },
        raw: responseText,
      };

      return NextResponse.json(ret);
    } finally {
      // Delete temp files
      try { fs.unlinkSync(filePathA); } catch (e) {}
      try { fs.unlinkSync(filePathB); } catch (e) {}
    }
  } catch (error) {
    console.error('Compare error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to compare offers' }, { status: 500 });
  }
}
