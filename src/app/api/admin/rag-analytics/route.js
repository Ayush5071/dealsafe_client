import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import enhancedVectorDb from '@/lib/enhancedVectorDb';

/**
 * Admin RAG Analytics API
 * Get quality metrics and improvement trends
 */

export async function GET(request) {
    try {
        const session = await getServerSession();

        // Only require authentication
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get quality metrics
        const metrics = await enhancedVectorDb.getQualityMetrics();

        return NextResponse.json({
            success: true,
            metrics
        });

    } catch (error) {
        console.error('RAG Analytics API error:', error);
        return NextResponse.json({
            error: 'Failed to fetch analytics',
            details: error?.message
        }, { status: 500 });
    }
}
