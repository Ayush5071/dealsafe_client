import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectMongoose } from '@/lib/mongoose';
import Feedback from '@/lib/models/Feedback';
import User from '@/lib/models/User';

// POST - Submit expert feedback
export async function POST(req) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectMongoose();

    const expert = await User.findOne({ email: session.user.email });
    if (!expert || !expert.isExpert) {
      return NextResponse.json({ error: 'Forbidden - Expert only' }, { status: 403 });
    }

    const body = await req.json();
    const {
      analysisId,
      documentName,
      userEmail,
      originalAnalysis,
      overallRating,
      accuracyScore,
      comments,
      suggestions,
      correctedClauses,
      additionalRisks,
      additionalBenefits,
      status
    } = body;

    if (!analysisId || !documentName || !userEmail) {
      return NextResponse.json({ 
        error: 'analysisId, documentName, and userEmail required' 
      }, { status: 400 });
    }

    const feedback = new Feedback({
      analysisId,
      documentName,
      userEmail,
      expertEmail: session.user.email,
      expertName: session.user.name || expert.name,
      originalAnalysis,
      overallRating,
      accuracyScore,
      comments,
      suggestions,
      correctedClauses,
      additionalRisks: additionalRisks || [],
      additionalBenefits: additionalBenefits || [],
      status: status || 'pending'
    });

    await feedback.save();

    // Store embedding for feedback so it becomes searchable in vector DB
    try {
      const { storeFeedbackEmbedding } = await import('@/lib/feedbackEmbeddings');
      storeFeedbackEmbedding(feedback).catch((e) => console.warn('storeFeedbackEmbedding error:', e));
    } catch (e) {
      console.warn('Failed to queue feedback embedding:', e?.message || e);
    }

    return NextResponse.json({ 
      success: true, 
      feedback,
      message: 'Feedback submitted successfully'
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - Retrieve feedback (for user or expert)
export async function GET(req) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectMongoose();

    const user = await User.findOne({ email: session.user.email });
    const { searchParams } = new URL(req.url);
    const analysisId = searchParams.get('analysisId');
    const userEmail = searchParams.get('userEmail');
    const feedbackId = searchParams.get('feedbackId');

    let query = {};

    if (feedbackId) {
      query._id = feedbackId;
    } else if (analysisId) {
      query.analysisId = analysisId;
    } else if (user?.isExpert) {
      // Experts can see all feedback or filter by user
      if (userEmail) {
        query.userEmail = userEmail;
      }
    } else {
      // Regular users can only see their own feedback
      query.userEmail = session.user.email;
    }

    const feedbacks = await Feedback.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    return NextResponse.json({ feedbacks });
  } catch (error) {
    console.error('Get feedback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update feedback status
export async function PUT(req) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectMongoose();

    const expert = await User.findOne({ email: session.user.email });
    if (!expert || !expert.isExpert) {
      return NextResponse.json({ error: 'Forbidden - Expert only' }, { status: 403 });
    }

    const body = await req.json();
    const { feedbackId, status } = body;

    if (!feedbackId || !status) {
      return NextResponse.json({ error: 'feedbackId and status required' }, { status: 400 });
    }

    const feedback = await Feedback.findByIdAndUpdate(
      feedbackId,
      { status },
      { new: true }
    );

    if (!feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, feedback });
  } catch (error) {
    console.error('Update feedback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
