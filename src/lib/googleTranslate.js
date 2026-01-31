/**
 * Google Translate Integration
 * Uses Google Cloud Translation API for accurate translations
 */

import { Translate } from '@google-cloud/translate/build/src/v2';

class GoogleTranslateClient {
    constructor() {
        this.apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
        this.available = !!this.apiKey;

        if (this.available) {
            this.translate = new Translate({ key: this.apiKey });
        } else {
            console.warn('GOOGLE_TRANSLATE_API_KEY not set; using fallback translation');
        }
    }

    /**
     * Translate text to target language
     * @param {string} text - Text to translate
     * @param {string} targetLang - Target language code (e.g., 'hi', 'es')
     * @returns {Promise<string>} Translated text
     */
    async translateText(text, targetLang) {
        if (!text || targetLang === 'en') {
            return text;
        }

        if (!this.available) {
            // Fallback: return original text with note
            console.warn('Google Translate not available, returning original text');
            return text;
        }

        try {
            const [translation] = await this.translate.translate(text, targetLang);
            return translation;
        } catch (error) {
            console.error('Google Translate error:', error);
            return text; // Return original on error
        }
    }

    /**
     * Translate JSON object fields recursively
     * @param {Object} obj - Object to translate
     * @param {string} targetLang - Target language code
     * @param {Array<string>} fieldsToTranslate - Field names to translate
     * @returns {Promise<Object>} Translated object
     */
    async translateObject(obj, targetLang, fieldsToTranslate = ['summary', 'description', 'recommendations', 'text']) {
        if (!obj || targetLang === 'en') {
            return obj;
        }

        const translated = { ...obj };

        for (const key of Object.keys(translated)) {
            const value = translated[key];

            if (fieldsToTranslate.includes(key) && typeof value === 'string') {
                // Translate this field
                translated[key] = await this.translateText(value, targetLang);
            } else if (Array.isArray(value)) {
                // Recursively translate array items
                translated[key] = await Promise.all(
                    value.map(item =>
                        typeof item === 'object'
                            ? this.translateObject(item, targetLang, fieldsToTranslate)
                            : typeof item === 'string' && fieldsToTranslate.includes(key)
                                ? this.translateText(item, targetLang)
                                : item
                    )
                );
            } else if (typeof value === 'object' && value !== null) {
                // Recursively translate nested objects
                translated[key] = await this.translateObject(value, targetLang, fieldsToTranslate);
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
    async translateAnalysis(analysis, targetLang) {
        if (!analysis || targetLang === 'en') {
            return analysis;
        }

        const fieldsToTranslate = [
            'summary',
            'description',
            'recommendations',
            'clause_name',
            'clause_text',
            'rewrite_suggestion',
            'text'
        ];

        return await this.translateObject(analysis, targetLang, fieldsToTranslate);
    }
}

// Singleton instance
const googleTranslateClient = new GoogleTranslateClient();

export default googleTranslateClient;
export { GoogleTranslateClient };
