import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectMongoose } from '@/lib/mongoose';
import Feedback from '@/lib/models/Feedback';
import User from '@/lib/models/User';

export async function GET(req) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectMongoose();
    const feedbacks = await Feedback.find({ userEmail: session.user.email }).sort({ createdAt: -1 }).limit(100);
    return NextResponse.json({ feedbacks });
  } catch (error) {
    console.error('Get user feedback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();

    // If client wants to create a new feedback entry from UI
    if (body && body.create === true) {
      const {
        analysisId,
        documentName,
        originalAnalysis,
        verdict,
        tags,
        rating,
        comments
      } = body;

      if (!analysisId || !documentName) return NextResponse.json({ error: 'analysisId and documentName required' }, { status: 400 });

      await connectMongoose();
      const userEmail = session.user.email;

      const fb = new Feedback({
        analysisId,
        type: 'user_feedback',
        documentName,
        userEmail,
        originalAnalysis: originalAnalysis || {},
        payload: {
          verdict: verdict || null,
          tags: tags || [],
          rating: rating || null,
          comments: comments || ''
        },
        status: 'user_provided'
      });

      await fb.save();

      // Store embedding for feedback so it becomes searchable in vector DB
      try {
        const { storeFeedbackEmbedding } = await import('@/lib/feedbackEmbeddings');
        storeFeedbackEmbedding(fb).catch((e) => console.warn('storeFeedbackEmbedding error:', e));
      } catch (e) {
        console.warn('Failed to queue feedback embedding:', e?.message || e);
      }

      return NextResponse.json({ success: true, feedback: fb });
    }

    // Otherwise, default behavior: append a comment to an existing feedback entry
    const { feedbackId, comment } = body;
    if (!feedbackId || !comment) return NextResponse.json({ error: 'feedbackId and comment required' }, { status: 400 });
    await connectMongoose();
    const fb = await Feedback.findById(feedbackId);
    if (!fb) return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    if (fb.userEmail !== session.user.email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // Append user comment to payload.userComments array
    fb.payload = fb.payload || {};
    fb.payload.userComments = fb.payload.userComments || [];
    fb.payload.userComments.push({ comment, date: new Date().toISOString() });
    await fb.save();
    return NextResponse.json({ success: true, feedback: fb });
  } catch (error) {
    console.error('Post user feedback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}