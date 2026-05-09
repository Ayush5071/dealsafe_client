import { NextResponse } from 'next/server';
import { ollamaClient } from '@/lib/llm';

export async function POST(request) {
    try {
        const { text } = await request.json();

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        const systemPrompt = `You are a helpful teacher explaining complex things to a 5-year-old child. 
    Rewrite the provided text in extremely simple language. 
    Use analogies (like toys, sharing, playground rules).
    Keep it short and fun. 
    Do not use big words.`;

        const simpleText = await ollamaClient.chat([
            { role: 'user', content: text }
        ], systemPrompt);

        return NextResponse.json({ simpleText });
    } catch (error) {
        console.error('Error in explain-simple:', error);
        return NextResponse.json({ error: 'Failed to simplify text' }, { status: 500 });
    }
}
