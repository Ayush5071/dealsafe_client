import { NextResponse } from 'next/server';
import { ollamaClient } from '@/lib/llm';
import vectorDb from '@/lib/vectorDb';
import { generateEmbeddings } from '@/lib/embeddings';

/**
 * Voice Chat API
 * Optimized for speech-to-speech interaction (concise answers, RAG-enabled)
 */

export async function POST(request) {
    try {
        const { question, conversationHistory } = await request.json();

        if (!question) {
            return NextResponse.json({ error: 'Question is required' }, { status: 400 });
        }

        console.log(`[Voice Chat] Question: ${question}`);

        // 1. Retrieve relevant contract chunks from vector DB
        // We search across ALL uploaded contracts for the user (ignoring specific filename filter for now to be broad)
        // Or we could try to infer context. For now, broad search is better for general "Start Voice Chat" button.
        await vectorDb.initialize(); // Ensure DB is loaded
        const questionEmbedding = await generateEmbeddings([question]);

        // Search top 3 chunks (fewer chunks for faster voice response)
        const relevantChunks = await vectorDb.search(
            questionEmbedding[0],
            3
        );

        // 2. Build context
        const context = relevantChunks
            .map(chunk => `[Source: ${chunk.metadata?.filename || 'Unknown'}]\n${chunk.text}`)
            .join('\n\n');

        // 3. Build prompt for Ollama
        // We want a very conversational, short answer.
        const systemPrompt = `You are Lawyer Sam, a helpful voice assistant for legal contracts.
        - Answer the user's question based ONLY on the provided Context.
        - Keep your answer SHORT (under 3 sentences).
        - Use simple, spoken language.
        - Do NOT use markdown formatting (no bold, no bullets, no tables) because this will be read out loud.
        - If the answer is not in the context, say "I don't see that in your contracts."
        `;

        const messages = [];
        if (conversationHistory && Array.isArray(conversationHistory)) {
            conversationHistory.forEach(msg => messages.push({ role: msg.role, content: msg.content }));
        }

        messages.push({
            role: 'user',
            content: `Context:\n${context}\n\nQuestion: ${question}`
        });

        // 4. Get response
        const response = await ollamaClient.chat(messages, systemPrompt);

        return NextResponse.json({
            success: true,
            answer: response
        });

    } catch (error) {
        console.error('Voice Chat API error:', error);
        return NextResponse.json({
            error: 'Failed to process voice query',
            details: error?.message
        }, { status: 500 });
    }
}
