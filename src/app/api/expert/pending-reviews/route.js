import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectMongoose } from '@/lib/mongoose';
import Feedback from '@/lib/models/Feedback';
import User from '@/lib/models/User';

// GET - Retrieve pending analyses awaiting expert review
export async function GET(req) {
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

    // Allow fetching a specific pending feedback by id
    const { searchParams } = new URL(req.url);
    const feedbackId = searchParams.get('feedbackId');

    let pendingReviews;
    if (feedbackId) {
      const doc = await Feedback.findOne({ _id: feedbackId, status: 'pending' });
      pendingReviews = doc ? [doc] : [];
    } else {
      // Get pending feedback items (those awaiting expert review)
      pendingReviews = await Feedback.find({ status: 'pending' })
        .sort({ createdAt: 1 })
        .limit(20);
    }

    return NextResponse.json({ reviews: pendingReviews });
  } catch (error) {
    console.error('Get pending reviews error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
