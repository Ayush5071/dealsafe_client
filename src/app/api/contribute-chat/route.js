import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import enhancedVectorDb from '@/lib/enhancedVectorDb';

/**
 * Chat Contribution API
 * Users can contribute their chat conversations for AI training
 */

export async function POST(request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { messages, contractText, metadata } = await request.json();

        if (!messages || messages.length === 0) {
            return NextResponse.json({
                error: 'Messages are required'
            }, { status: 400 });
        }

        // Create a unique ID for this contribution
        const contributionId = `chat_${Date.now()}_${session.user.email.split('@')[0]}`;

        // Format the conversation for storage
        const conversationText = messages.map(m =>
            `${m.role.toUpperCase()}: ${m.content}`
        ).join('\n\n');

        // Generate embedding for the conversation
        const { generateEmbeddings } = await import('@/lib/embeddings');
        const embeddings = await generateEmbeddings([conversationText]);

        // Store in enhanced vector DB as pending review
        await enhancedVectorDb.addVectors([{
            text: conversationText,
            embedding: embeddings[0],
            metadata: {
                source: contributionId,
                chunkId: 0,
                sourceType: 'chat_contribution',
                contributedBy: session.user.email,
                messageCount: messages.length,
                hasContract: !!contractText,
                ...metadata
            }
        }], session.user.email);

        console.log('[Chat Contribution] User contributed chat:', contributionId);

        return NextResponse.json({
            success: true,
            contributionId,
            message: 'Thank you for contributing! Your chat will help improve the AI.',
            status: 'pending_review'
        });

    } catch (error) {
        console.error('Chat Contribution API error:', error);
        return NextResponse.json({
            error: 'Failed to submit contribution',
            details: error?.message
        }, { status: 500 });
    }
}
