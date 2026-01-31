import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getUserProfile } from '@/lib/db';
import { 
  getPendingReviews, 
  expertReviewAnalysis, 
  reAnalyzeWithFeedback,
  checkHILStatus 
} from '@/lib/hilOrchestrator';
import { connectMongoose } from '@/lib/mongoose';

export async function GET(req) {
  try {
    // Authenticate expert user
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const userProfile = await getUserProfile(token.email);
    if (!userProfile?.expert && !userProfile?.isExpert && !userProfile?.isAdmin) {
      return NextResponse.json({ error: 'Expert access required' }, { status: 403 });
    }
    
    const pendingReviews = await getPendingReviews(token.email);
    
    return NextResponse.json({
      pending_reviews: pendingReviews,
      total_count: pendingReviews.length,
      expert_email: token.email
    });
    
  } catch (error) {
    console.error('HIL Review GET error:', error);
    return NextResponse.json({ 
      error: error?.message || 'Failed to get pending reviews' 
    }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    // Authenticate expert user
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const userProfile = await getUserProfile(token.email);
    if (!userProfile?.expert && !userProfile?.isExpert && !userProfile?.isAdmin) {
      return NextResponse.json({ error: 'Expert access required' }, { status: 403 });
    }
    
    const { hil_id, action, feedback } = await req.json();
    
    if (!hil_id || !action) {
      return NextResponse.json({ error: 'HIL ID and action are required' }, { status: 400 });
    }
    
    let result;
    
    if (action === 'approve') {
      result = await expertReviewAnalysis(hil_id, token.email, true, feedback);
    } else if (action === 'reject') {
      result = await expertReviewAnalysis(hil_id, token.email, false, feedback);
    } else if (action === 'request_reanalysis') {
      // This would trigger re-analysis with feedback
      result = await expertReviewAnalysis(hil_id, token.email, false, {
        ...feedback,
        request_reanalysis: true
      });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('HIL Review POST error:', error);
    return NextResponse.json({ 
      error: error?.message || 'Failed to process expert review' 
    }, { status: 500 });
  }
}

// Check status of specific HIL analysis
export async function PUT(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const { analysis_id } = await req.json();
    if (!analysis_id) {
      return NextResponse.json({ error: 'Analysis ID required' }, { status: 400 });
    }
    
    const status = await checkHILStatus(analysis_id, token.email);
    
    return NextResponse.json(status);
    
  } catch (error) {
    console.error('HIL Status check error:', error);
    return NextResponse.json({ 
      error: error?.message || 'Failed to check HIL status' 
    }, { status: 500 });
  }
}