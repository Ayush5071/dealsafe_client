import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ragWorkflow } from '@/lib/workflows/ragWorkflow';

/**
 * RAG Test API
 * Test the RAG pipeline with sample queries
 */

export async function POST(request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { query, contractText } = await request.json();

        if (!query) {
            return NextResponse.json({
                error: 'Query is required'
            }, { status: 400 });
        }

        const testContract = contractText || `
      EMPLOYMENT AGREEMENT
      
      This Employment Agreement is entered into between Company XYZ and Employee.
      
      1. COMPENSATION: Employee shall receive $100,000 per year.
      2. TERMINATION: Either party may terminate with 30 days notice.
      3. CONFIDENTIALITY: Employee agrees to maintain confidentiality.
      4. NON-COMPETE: Employee agrees not to compete for 1 year after termination.
    `;

        console.log('[RAG Test] Testing with query:', query);

        // Execute RAG workflow
        const result = await ragWorkflow.execute(
            query,
            testContract,
            session.user.email
        );

        return NextResponse.json({
            success: true,
            result: {
                status: result.status,
                retrievedChunks: result.retrievedChunks.length,
                analysis: result.analysis,
                confidence: result.confidence,
                needsReview: result.needsReview,
                context: result.context.substring(0, 500) + '...'
            }
        });

    } catch (error) {
        console.error('RAG Test API error:', error);
        return NextResponse.json({
            error: 'Failed to test RAG pipeline',
            details: error?.message
        }, { status: 500 });
    }
}
