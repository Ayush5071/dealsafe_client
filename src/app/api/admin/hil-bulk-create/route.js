import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getUserProfile, ensureAdminSetup } from '@/lib/db';
import { connectMongoose } from '@/lib/mongoose';
import Feedback from '@/lib/models/Feedback';

// Hardcoded sample company review snippets (no crawling)
const COMPANY_SNIPPETS = {
  'Acme Corp': [
    { source: 'Glassdoor', snippets: ['Pays on time, decent benefits', 'Middle management can be disorganized'] },
    { source: 'AmbitionBox', snippets: ['Good learning opportunities for juniors', 'Work-life balance varies by team'] }
  ],
  'Globex': [
    { source: 'Glassdoor', snippets: ['Fast paced, high growth', 'Occasional long hours during sprints'] },
    { source: 'AmbitionBox', snippets: ['Competitive pay, good leadership', 'Interview process is rigorous'] }
  ],
  'Initech': [
    { source: 'Glassdoor', snippets: ['Engineering-first culture', 'Legacy systems can be a challenge'] },
    { source: 'AmbitionBox', snippets: ['Supportive colleagues', 'Career progression is possible with initiative'] }
  ],
  'Hooli': [
    { source: 'Glassdoor', snippets: ['Generous perks and offices', 'Can be bureaucratic at times'] },
    { source: 'AmbitionBox', snippets: ['Excellent on-campus recruiting', 'Fast promotion for top performers'] }
  ],
  'Umbrella': [
    { source: 'Glassdoor', snippets: ['Strong R&D focus', 'Some teams are siloed'] },
    { source: 'AmbitionBox', snippets: ['Good stability, conservative management', 'Less exciting product roadmap'] }
  ]
};

export async function POST(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const profile = await getUserProfile(token.email);
    if (!profile?.isAdmin && !(process.env.DEFAULT_ADMIN_EMAILS || '').split(',').map(s=>s.trim().toLowerCase()).includes(token.email.toLowerCase())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(()=>({}));
    const company = (body.company && String(body.company).trim()) || 'Acme Corp';
    let count = parseInt(body.count || 40, 10) || 40;
    if (count < 1) count = 1;
    if (count > 500) count = 500; // safety cap

    await connectMongoose();
    await ensureAdminSetup(token.email);

    const snippets = COMPANY_SNIPPETS[company] || [ { source: 'Glassdoor', snippets: ['No external reviews available for this company.'] } ];

    const created = [];
    for (let i = 0; i < count; i++) {
      const analysisId = `hil_temp_${company.replace(/\s+/g,'_')}_${Date.now()}_${i}`;
      const docName = `${company} — sample contract ${i+1}`;
      const sampleText = `This is an auto-generated HIL test document for ${company}. Sample contract clause ${i+1}...`;

      const fb = new Feedback({
        analysisId,
        type: 'hil_analysis',
        documentName: docName,
        userEmail: token.email,
        expertEmail: token.email,
        originalAnalysis: { summary: `Auto HIL analysis sample for ${company}`, generatedIndex: i+1 },
        payload: {
          document_text: sampleText,
          user_role: 'tester',
          company: company,
          external_reviews: snippets
        },
        status: 'pending_expert_review',
        metadata: {
          hil_mandatory: true,
          training_priority: 'low'
        }
      });

      await fb.save();
      created.push({ id: fb._id, analysisId, documentName: docName });
    }

    return NextResponse.json({ success: true, created_count: created.length, samples: created.slice(0, 10), company });
  } catch (err) {
    console.error('Failed to create bulk HIL test items:', err);
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}