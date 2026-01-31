/**
 * MyMemory Translation API Integration (FREE!)
 * Uses MyMemory public API - no API key required, very reliable
 * Limit: 1000 words/day per IP (sufficient for most use cases)
 */

/**
 * Translate text using MyMemory free API
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code (e.g., 'hi', 'es')
 * @param {string} sourceLang - Source language code (default: 'en')
 * @returns {Promise<string>} Translated text
 */
export async function translateText(text, targetLang, sourceLang = 'en') {
    if (!text || targetLang === sourceLang || !text.trim()) {
        return text;
    }

    // Limit text length to avoid API issues
    const maxLength = 500;
    const chunks = [];

    if (text.length > maxLength) {
        // Split into chunks
        for (let i = 0; i < text.length; i += maxLength) {
            chunks.push(text.substring(i, i + maxLength));
        }
    } else {
        chunks.push(text);
    }

    try {
        const translations = await Promise.all(
            chunks.map(async (chunk) => {
                const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${sourceLang}|${targetLang}`;

                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`Translation failed: ${response.statusText}`);
                }

                const data = await response.json();

                if (data.responseStatus === 200 && data.responseData) {
                    return data.responseData.translatedText;
                } else {
                    console.warn('MyMemory API returned error:', data.responseDetails);
                    return chunk; // Return original chunk on error
                }
            })
        );

        return translations.join('');
    } catch (error) {
        console.error('MyMemory translation error:', error.message);
        return text; // Return original on error
    }
}

/**
 * Translate multiple texts in batch
 * @param {Array<string>} texts - Array of texts to translate
 * @param {string} targetLang - Target language code
 * @param {string} sourceLang - Source language code
 * @returns {Promise<Array<string>>} Array of translated texts
 */
export async function translateBatch(texts, targetLang, sourceLang = 'en') {
    if (!texts || texts.length === 0 || targetLang === sourceLang) {
        return texts;
    }

    try {
        // Translate with small delays to avoid rate limiting
        const translations = [];
        for (let i = 0; i < texts.length; i++) {
            if (i > 0) {
                // 200ms delay between requests
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            const translated = await translateText(texts[i], targetLang, sourceLang);
            translations.push(translated);
        }
        return translations;
    } catch (error) {
        console.error('Batch translation error:', error);
        return texts;
    }
}

/**
 * Translate object fields recursively
 * @param {Object} obj - Object to translate
 * @param {string} targetLang - Target language code
 * @param {Array<string>} fieldsToTranslate - Field names to translate
 * @returns {Promise<Object>} Translated object
 */
export async function translateObject(obj, targetLang, fieldsToTranslate = ['summary', 'description', 'recommendations', 'text']) {
    if (!obj || targetLang === 'en') {
        return obj;
    }

    const translated = { ...obj };

    for (const key of Object.keys(translated)) {
        const value = translated[key];

        if (fieldsToTranslate.includes(key) && typeof value === 'string' && value.length > 0) {
            // Translate this field
            translated[key] = await translateText(value, targetLang);
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        } else if (Array.isArray(value)) {
            // Recursively translate array items
            const translatedArray = [];
            for (let i = 0; i < value.length; i++) {
                const item = value[i];
                if (typeof item === 'object' && item !== null) {
                    translatedArray.push(await translateObject(item, targetLang, fieldsToTranslate));
                } else if (typeof item === 'string' && fieldsToTranslate.includes(key)) {
                    translatedArray.push(await translateText(item, targetLang));
                    await new Promise(resolve => setTimeout(resolve, 100));
                } else {
                    translatedArray.push(item);
                }
            }
            translated[key] = translatedArray;
        } else if (typeof value === 'object' && value !== null) {
            // Recursively translate nested objects
            translated[key] = await translateObject(value, targetLang, fieldsToTranslate);
        }
    }

    return translated;
}

/**
 * Translate contract analysis to target language
 * @param {Object} analysis - Contract analysis object
 * @param {string} targetLang - Target language code
 * @returns {Promise<Object>} Translated analysis
 */
export async function translateAnalysis(analysis, targetLang) {
    if (!analysis || targetLang === 'en') {
        return analysis;
    }

    console.log(`Translating analysis to ${targetLang} using MyMemory API...`);

    const fieldsToTranslate = [
        'summary',
        'description',
        'recommendations',
        'clause_name',
        'clause_text',
        'rewrite_suggestion',
        'text',
        'answer'
    ];

    return await translateObject(analysis, targetLang, fieldsToTranslate);
}

export default {
    translateText,
    translateBatch,
    translateObject,
    translateAnalysis
};
