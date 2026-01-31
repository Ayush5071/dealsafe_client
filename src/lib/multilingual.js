import { ollamaClient } from './llm';

/**
 * Multilingual Support Library
 * Handles language detection and translation for contracts and chat
 */

// Supported languages
export const SUPPORTED_LANGUAGES = {
    en: { name: 'English', flag: '🇬🇧' },
    es: { name: 'Spanish', flag: '🇪🇸' },
    fr: { name: 'French', flag: '🇫🇷' },
    de: { name: 'German', flag: '🇩🇪' },
    hi: { name: 'Hindi', flag: '🇮🇳' },
    zh: { name: 'Chinese', flag: '🇨🇳' },
    ja: { name: 'Japanese', flag: '🇯🇵' },
    ar: { name: 'Arabic', flag: '🇸🇦' },
    pt: { name: 'Portuguese', flag: '🇵🇹' },
    ru: { name: 'Russian', flag: '🇷🇺' },
    it: { name: 'Italian', flag: '🇮🇹' },
    ko: { name: 'Korean', flag: '🇰🇷' }
};

/**
 * Detect language of text using AI
 */
export async function detectLanguage(text) {
    const prompt = `Detect the language of the following text. Respond with ONLY the ISO 639-1 language code (e.g., 'en', 'es', 'fr', 'de', 'hi', 'zh', 'ja', 'ar', 'pt', 'ru', 'it', 'ko').

TEXT:
${text.substring(0, 500)}

Language code:`;

    try {
        const response = await ollamaClient.chat(
            [{ role: 'user', content: prompt }],
            'You are a language detection expert.'
        );

        const langCode = response.trim().toLowerCase().substring(0, 2);

        // Validate it's a supported language
        if (SUPPORTED_LANGUAGES[langCode]) {
            return langCode;
        }

        return 'en'; // Default to English
    } catch (error) {
        console.error('[Language Detection] Error:', error);
        return 'en';
    }
}

/**
 * Translate text from one language to another
 */
export async function translateText(text, fromLang, toLang) {
    if (fromLang === toLang) {
        return text; // No translation needed
    }

    const fromName = SUPPORTED_LANGUAGES[fromLang]?.name || 'Unknown';
    const toName = SUPPORTED_LANGUAGES[toLang]?.name || 'English';

    const prompt = `Translate the following text from ${fromName} to ${toName}. Maintain the original meaning, tone, and legal terminology. Respond with ONLY the translated text.

TEXT TO TRANSLATE:
${text}

TRANSLATION:`;

    try {
        const response = await ollamaClient.chat(
            [{ role: 'user', content: prompt }],
            'You are a professional legal translator.'
        );

        return response.trim();
    } catch (error) {
        console.error('[Translation] Error:', error);
        return text; // Return original if translation fails
    }
}

/**
 * Translate contract analysis to user's preferred language
 */
export async function translateAnalysis(analysis, targetLang) {
    if (targetLang === 'en') {
        return analysis; // Already in English
    }

    const targetName = SUPPORTED_LANGUAGES[targetLang]?.name || 'English';

    const prompt = `Translate the following contract analysis to ${targetName}. Maintain legal accuracy and terminology. Return a JSON object with the same structure.

ANALYSIS:
${JSON.stringify(analysis, null, 2)}

Respond with ONLY the translated JSON object:`;

    try {
        const response = await ollamaClient.chat(
            [{ role: 'user', content: prompt }],
            'You are a professional legal translator.'
        );

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return analysis; // Return original if parsing fails
    } catch (error) {
        console.error('[Analysis Translation] Error:', error);
        return analysis;
    }
}

/**
 * Analyze contract in its original language
 */
export async function analyzeInLanguage(contractText, language) {
    const langName = SUPPORTED_LANGUAGES[language]?.name || 'English';

    const prompt = `Analyze this contract written in ${langName}. Provide analysis in the SAME language (${langName}).

CONTRACT:
${contractText.substring(0, 3000)}

Provide:
1. Summary
2. Key risks
3. Recommendations
4. Missing clauses

Return JSON in ${langName}:
{
  "summary": "summary in ${langName}",
  "risks": ["risk 1 in ${langName}", "risk 2 in ${langName}"],
  "recommendations": ["rec 1 in ${langName}", "rec 2 in ${langName}"],
  "missingClauses": ["clause 1 in ${langName}", "clause 2 in ${langName}"]
}`;

    try {
        const response = await ollamaClient.chat(
            [{ role: 'user', content: prompt }],
            `You are an expert contract analyst fluent in ${langName}.`
        );

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return {
            summary: response,
            risks: [],
            recommendations: [],
            missingClauses: []
        };
    } catch (error) {
        console.error('[Multilingual Analysis] Error:', error);
        throw error;
    }
}

/**
 * Chat in user's preferred language
 */
export async function chatInLanguage(question, context, language) {
    const langName = SUPPORTED_LANGUAGES[language]?.name || 'English';

    const prompt = `Answer the following question about a contract in ${langName}. The user asked in ${langName}, so respond in ${langName}.

CONTEXT:
${context}

QUESTION (in ${langName}):
${question}

ANSWER (in ${langName}):`;

    try {
        const response = await ollamaClient.chat(
            [{ role: 'user', content: prompt }],
            `You are a helpful legal assistant fluent in ${langName}.`
        );

        return response.trim();
    } catch (error) {
        console.error('[Multilingual Chat] Error:', error);
        throw error;
    }
}

export default {
    detectLanguage,
    translateText,
    translateAnalysis,
    analyzeInLanguage,
    chatInLanguage,
    SUPPORTED_LANGUAGES
};
