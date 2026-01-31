import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getUserProfile } from '@/lib/db';
import Feedback from '@/lib/models/Feedback';
import { connectMongoose } from '@/lib/mongoose';
import { ensureAdminSetup } from '@/lib/db';

export async function POST(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const profile = await getUserProfile(token.email);
    if (!profile?.isAdmin && !(process.env.DEFAULT_ADMIN_EMAILS || '').split(',').map(s=>s.trim().toLowerCase()).includes(token.email.toLowerCase())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await connectMongoose();
    await ensureAdminSetup(token.email);

    const body = await req.json().catch(()=>({}));
    const { documentName = 'test_doc.txt', document_text = 'Test HIL document content', type = 'upload' } = body || {};

    const fb = new Feedback({
      analysisId: `hil_test_${Date.now()}`,
      type: 'hil_analysis',
      documentName,
      userEmail: token.email,
      expertEmail: token.email,
      originalAnalysis: { summary: 'Test HIL placeholder analysis' },
      payload: { document_text, user_role: body.user_role || 'tester' },
      status: 'pending_expert_review',
      metadata: { hil_mandatory: true }
    });

    await fb.save();

    return NextResponse.json({ success: true, hil_id: fb._id, status: fb.status });
  } catch (err) {
    console.error('Failed to create test HIL item:', err);
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}