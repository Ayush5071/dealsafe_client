import { NextResponse } from 'next/server';
import { ollamaClient } from '@/lib/llm';
import vectorDb from '@/lib/vectorDb';
import { generateEmbeddings } from '@/lib/embeddings';

/**
 * Chat with Your Contract API
 * Interactive Q&A about uploaded contracts using Qwen
 */

export async function POST(request) {
    try {
        const { filename, question, conversationHistory } = await request.json();

        if (!filename || !question) {
            return NextResponse.json({
                error: 'Filename and question are required'
            }, { status: 400 });
        }

        console.log(`[Contract Chat] Question about ${filename}: ${question}`);

        // Retrieve relevant contract chunks from vector DB
        await vectorDb.initialize();
        const questionEmbedding = await generateEmbeddings([question]);

        const relevantChunks = await vectorDb.search(
            questionEmbedding[0],
            5,
            (item) => item.metadata?.source === filename
        );

        // Build context from relevant chunks
        const context = relevantChunks
            .map(chunk => chunk.text)
            .join('\n\n');

        // Build conversation messages
        const messages = [];

        // Add conversation history if provided
        if (conversationHistory && conversationHistory.length > 0) {
            conversationHistory.forEach(msg => {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            });
        }

        // Add current question with context
        messages.push({
            role: 'user',
            content: `Based on the following contract sections, please answer this question:

QUESTION: ${question}

RELEVANT CONTRACT SECTIONS:
${context}

Provide a clear, concise answer based on the contract text. If the information is not in the contract, say so.`
        });

        // Get response from Qwen
        const response = await ollamaClient.chat(
            messages,
            'You are a helpful contract analysis assistant. Answer questions accurately based on the contract text provided.'
        );

        return NextResponse.json({
            success: true,
            answer: response,
            relevantSections: relevantChunks.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Contract Chat API error:', error);
        return NextResponse.json({
            error: 'Failed to process question',
            details: error?.message || 'Unknown error'
        }, { status: 500 });
    }
}
