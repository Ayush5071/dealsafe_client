import { NextResponse } from 'next/server';
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
        const candidatesStr = form.get('candidates');
        const file = form.get('file');

        if (!candidatesStr || !file) {
            return NextResponse.json({ error: 'Candidates list and Interviewer CSV are required' }, { status: 400 });
        }

        let candidates;
        try {
            candidates = JSON.parse(candidatesStr);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid candidates JSON' }, { status: 400 });
        }

        const csvText = await file.text();
        const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
            return NextResponse.json({ error: 'CSV file is empty or missing headers' }, { status: 400 });
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        // minimal validation of headers? 
        // expecting name, stack, current project, department, designation (fuzzy match)

        const interviewers = lines.slice(1).map(line => {
            const values = line.split(',');
            const obj = {};
            headers.forEach((h, i) => {
                obj[h] = values[i]?.trim() || '';
            });
            return obj;
        });

        const matches = [];

        // Process chunk of candidates or one-by-one? 
        // Let's do one-by-one or small batches to avoid context limit if many candidates/interviewers.
        // For now, let's do one prompt per candidate to be safe and accurate.

        // Convert interviewers to a concise string for the prompt
        // Format: "ID: 1 | Name: John | Stack: React... "
        const interviewersText = interviewers.map((int, i) =>
            `ID: ${i} | Name: ${int.name || 'Unknown'} | Stack: ${int.stack || int.skills || ''} | Project: ${int['current project'] || int.project || ''} | Dept: ${int.department || ''} | Desig: ${int.designation || ''}`
        ).join('\n');

        for (const candidate of candidates) {
            const prompt = `
        You are an expert HR coordinator. 
        Match the following candidate to the BEST single interviewer from the provided list.
        
        CANDIDATE:
        Name: ${candidate.name}
        Skills/Highlights: ${(candidate.highlights || []).join(', ')}
        Pros: ${(candidate.pros || []).join(', ')}
        
        INTERVIEWERS LIST:
        ${interviewersText}
        
        CRITERIA:
        - Match technical stack (candidate skills vs interviewer stack).
        - Match seniority if implied.
        - Prioritize relevance of current project if known.
        
        Return a JSON object: { "interviewer_name": "Name from list", "reason": "Why this person is the best match" }.
        Return ONLY valid JSON.
        `;

            try {
                const res = await ollamaClient.chat([{ role: 'user', content: prompt }], "You are a helpful assistant that outputs only JSON.");
                const m = res.match(/\{[\s\S]*\}/);
                if (m) {
                    const json = JSON.parse(m[0]);
                    matches.push({
                        candidateName: candidate.name,
                        match: json
                    });
                } else {
                    matches.push({
                        candidateName: candidate.name,
                        match: { interviewer_name: "Unknown", reason: "Failed to parse match result" }
                    });
                }
            } catch (err) {
                console.error(`Matching failed for candidate ${candidate.name}`, err);
                matches.push({
                    candidateName: candidate.name,
                    match: { interviewer_name: "Error", reason: "AI processing failed" }
                });
            }
        }

        return NextResponse.json({ matches });

    } catch (err) {
        console.error('Match interviewers error', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
