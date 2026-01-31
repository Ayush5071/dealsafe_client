import { NextResponse } from 'next/server';
import elevenLabsClient from '@/lib/elevenlabs';

export async function POST(request) {
    try {
        const { text, voiceId } = await request.json();

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        if (!elevenLabsClient.available) {
            return NextResponse.json({
                error: 'ElevenLabs TTS not configured. Please set ELEVENLABS_API_KEY in environment variables.'
            }, { status: 503 });
        }

        // Convert text to speech
        const audioBuffer = await elevenLabsClient.textToSpeech(text, voiceId);

        // Return audio as response
        return new NextResponse(audioBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBuffer.length.toString(),
                'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            },
        });
    } catch (error) {
        console.error('TTS API error:', error);
        return NextResponse.json({
            error: 'Failed to generate speech',
            details: error?.message || 'Unknown error'
        }, { status: 500 });
    }
}
