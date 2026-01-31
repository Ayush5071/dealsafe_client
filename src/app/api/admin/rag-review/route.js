import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import enhancedVectorDb from '@/lib/enhancedVectorDb';

/**
 * Admin RAG Review API
 * Fetch and manage pending analyses for admin review
 */

export async function GET(request) {
    try {
        const session = await getServerSession();

        // Check authentication
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is admin (using env variable)
        const adminEmails = (process.env.DEFAULT_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
        const isAdmin = adminEmails.includes(session.user.email.toLowerCase());

        console.log('[RAG Review] User:', session.user.email, 'Is Admin:', isAdmin);

        // Get unreviewed analyses
        const pending = await enhancedVectorDb.getUnreviewedAnalyses(50);

        console.log('[RAG Review] Found pending reviews:', pending.length);

        return NextResponse.json({
            success: true,
            pending,
            count: pending.length,
            isAdmin
        });

    } catch (error) {
        console.error('RAG Review API error:', error);
        return NextResponse.json({
            error: 'Failed to fetch pending reviews',
            details: error?.message
        }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await getServerSession();

        // Only require authentication
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { source, userId, feedback } = await request.json();

        if (!source || !userId || !feedback) {
            return NextResponse.json({
                error: 'Source, userId, and feedback are required'
            }, { status: 400 });
        }

        // Update with admin feedback
        const result = await enhancedVectorDb.updateWithFeedback(source, userId, {
            ...feedback,
            adminEmail: session.user.email
        });

        return NextResponse.json({
            success: true,
            updated: result.updated,
            message: 'Feedback stored successfully'
        });

    } catch (error) {
        console.error('RAG Review POST error:', error);
        return NextResponse.json({
            error: 'Failed to store feedback',
            details: error?.message
        }, { status: 500 });
    }
}
