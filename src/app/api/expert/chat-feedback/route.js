import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import Feedback from '@/lib/models/Feedback';
import { connectMongoose } from '@/lib/mongoose';
import { getUserProfile } from '@/lib/db';
import { ollamaClient } from '@/lib/llm';
import { storeFeedbackEmbedding } from '@/lib/feedbackEmbeddings';
import { storeHILTrainingData } from '@/lib/hilTraining';

export async function POST(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const profile = await getUserProfile(token.email).catch(()=>null);
    if (!profile?.isExpert && !profile?.expert && !profile?.isAdmin) {
      return NextResponse.json({ error: 'Expert access required' }, { status: 403 });
    }

    await connectMongoose();

    const body = await req.json();
    const { feedback_id, action, comments } = body || {};
    if (!feedback_id || !action) return NextResponse.json({ error: 'feedback_id and action required' }, { status: 400 });

    const fb = await Feedback.findById(feedback_id);
    if (!fb) return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });

    // Only experts can act
    fb.expertEmail = token.email;

    if (action === 'approve') {
      fb.status = 'approved';
      fb.comments = comments || fb.comments || '';
      // Persist embedding and training data
      try {
        await storeFeedbackEmbedding(fb);
      } catch (e) { console.warn('Embedding save failed:', e); }

      // For chat feedback, build an enhanced training text from question+answer+comments
      try {
        const docText = `${fb.originalAnalysis?.question || ''}\n\nANSWER:\n${fb.originalAnalysis?.answer || ''}\n\nEXPERT_COMMENTS:\n${fb.comments || comments || ''}`;
        const metrics = await storeHILTrainingData(fb, docText).catch((e)=>{ console.warn('storeHILTrainingData failed:', e); return null; });
        fb.metadata = fb.metadata || {};
        if (metrics) {
          fb.metadata.hil_vectorized = true;
          fb.metadata.last_training_metrics = metrics;
        }
      } catch (e) {
        console.warn('HIL training storage failed:', e);
      }

      await fb.save();

      return NextResponse.json({ success: true, status: fb.status, hil_vectorized: !!fb.metadata?.hil_vectorized, last_training_metrics: fb.metadata?.last_training_metrics || null });

    } else if (action === 'reject' || action === 'request_reanalysis') {
      fb.status = 'needs_revision';
      fb.metadata = fb.metadata || {};
      fb.metadata.re_analysis_count = (fb.metadata.re_analysis_count || 0) + 1;
      fb.comments = comments || fb.comments || '';

      // Trigger re-answer using existing sources (if any)
      const sources = fb.payload?.sources || [];
      let context = '';
      try {
        context = (sources || []).map(s => s.snippet || s.text || '').filter(Boolean).slice(0,10).join('\n\n');
      } catch (e) { context = ''; }

      const expertContextNote = `EXPERT_FEEDBACK: ${fb.comments || ''} \n\nIMPORTANT: The previous answer was rejected by an expert. Rethink the analysis and provide a corrected, concise answer strictly based on the context below.`;

      const systemPrompt = `You are a helpful assistant that answers questions based STRICTLY on the provided context from uploaded PDF documents. ${expertContextNote} \n\nCONTEXT:\n${context}`;

      const question = fb.originalAnalysis?.question || '';
      let newAnswer = null;
      try {
        newAnswer = await ollamaClient.chat([
          { role: 'user', content: question }
        ], systemPrompt);

        // Update feedback with re-answer and status back to pending_expert_review
        fb.originalAnalysis = { question, answer: newAnswer };
        fb.status = 'pending_expert_review';
        await fb.save();

        return NextResponse.json({ success: true, status: fb.status, reanalysis_result: { question, answer: newAnswer } });
      } catch (e) {
        console.error('Re-answer failed:', e);
        await fb.save();
        return NextResponse.json({ error: 'Failed to re-answer', details: e?.message || String(e) }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (err) {
    console.error('Expert chat feedback error:', err);
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}