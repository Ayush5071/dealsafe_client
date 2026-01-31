import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { detectLanguage, translateText, SUPPORTED_LANGUAGES } from '@/lib/multilingual';

/**
 * Language Detection & Translation API
 */

// POST - Detect language
export async function POST(request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { text, action, fromLang, toLang } = await request.json();

        if (!text) {
            return NextResponse.json({
                error: 'Text is required'
            }, { status: 400 });
        }

        if (action === 'detect') {
            // Detect language
            const detectedLang = await detectLanguage(text);

            return NextResponse.json({
                success: true,
                language: detectedLang,
                languageName: SUPPORTED_LANGUAGES[detectedLang]?.name,
                confidence: 0.9
            });
        } else if (action === 'translate') {
            // Translate text
            if (!fromLang || !toLang) {
                return NextResponse.json({
                    error: 'fromLang and toLang are required for translation'
                }, { status: 400 });
            }

            const translated = await translateText(text, fromLang, toLang);

            return NextResponse.json({
                success: true,
                originalText: text,
                translatedText: translated,
                fromLang,
                toLang
            });
        } else {
            return NextResponse.json({
                error: 'Invalid action. Use "detect" or "translate"'
            }, { status: 400 });
        }

    } catch (error) {
        console.error('Language API error:', error);
        return NextResponse.json({
            error: 'Failed to process language request',
            details: error?.message
        }, { status: 500 });
    }
}

// GET - Get supported languages
export async function GET(request) {
    return NextResponse.json({
        success: true,
        languages: SUPPORTED_LANGUAGES
    });
}
