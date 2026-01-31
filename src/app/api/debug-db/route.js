import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import enhancedVectorDb from '@/lib/enhancedVectorDb';

/**
 * Debug API to check database contents
 */

export async function GET(request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Initialize DB
        await enhancedVectorDb.initialize();

        // Get all documents
        const allDocs = enhancedVectorDb.db.prepare(`
      SELECT id, source, userId, adminReviewed, createdAt 
      FROM documents 
      ORDER BY createdAt DESC 
      LIMIT 20
    `).all();

        // Get unreviewed count
        const unreviewedCount = enhancedVectorDb.db.prepare(`
      SELECT COUNT(DISTINCT source) as count
      FROM documents
      WHERE adminReviewed = 0
    `).get();

        // Get pending analyses using the method
        const pending = await enhancedVectorDb.getUnreviewedAnalyses(20);

        return NextResponse.json({
            success: true,
            allDocuments: allDocs,
            unreviewedCount: unreviewedCount.count,
            pendingAnalyses: pending,
            dbPath: enhancedVectorDb.db.name
        });

    } catch (error) {
        console.error('Debug API error:', error);
        return NextResponse.json({
            error: 'Failed to fetch debug info',
            details: error?.message
        }, { status: 500 });
    }
}
