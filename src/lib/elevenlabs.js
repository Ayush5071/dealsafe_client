import axios from 'axios';

/**
 * ElevenLabs TTS/STT Client
 * Provides text-to-speech and speech-to-text capabilities
 */

export class ElevenLabsClient {
    constructor() {
        this.apiKey = process.env.ELEVENLABS_API_KEY;
        this.voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
        this.baseUrl = 'https://api.elevenlabs.io/v1';
        this.available = !!this.apiKey;

        if (!this.available) {
            console.warn('ELEVENLABS_API_KEY not set; ElevenLabs features will be unavailable');
        }
    }

    /**
     * Convert text to speech
     * @param {string} text - Text to convert to speech
     * @param {string} voiceId - Optional voice ID override
     * @returns {Promise<Buffer>} Audio buffer
     */
    async textToSpeech(text, voiceId = null) {
        if (!this.available) {
            throw new Error('ElevenLabs API key not configured');
        }

        const voice = voiceId || this.voiceId;
        const url = `${this.baseUrl}/text-to-speech/${voice}`;

        try {
            const response = await axios.post(
                url,
                {
                    text,
                    model_id: 'eleven_turbo_v2_5', // Free tier compatible model
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                    },
                },
                {
                    headers: {
                        'Accept': 'audio/mpeg',
                        'Content-Type': 'application/json',
                        'xi-api-key': this.apiKey,
                    },
                    responseType: 'arraybuffer',
                }
            );

            return Buffer.from(response.data);
        } catch (error) {
            // Better error logging
            if (error?.response?.data) {
                const errorData = Buffer.from(error.response.data).toString();
                console.error('ElevenLabs TTS detailed error:', errorData);
            } else {
                console.error('ElevenLabs TTS error:', error?.message);
            }
            throw new Error('Failed to convert text to speech: ' + (error?.message || 'Unknown error'));
        }
    }

    /**
     * Convert speech to text
     * @param {Buffer} audioBuffer - Audio file buffer
     * @returns {Promise<string>} Transcribed text
     */
    async speechToText(audioBuffer) {
        if (!this.available) {
            throw new Error('ElevenLabs API key not configured');
        }

        // Note: ElevenLabs primarily focuses on TTS
        // For STT, we'll use a fallback or alternative service
        // You might want to use OpenAI Whisper or Google Speech-to-Text instead

        throw new Error('Speech-to-Text not yet implemented. Consider using OpenAI Whisper API.');
    }

    /**
     * Get available voices
     * @returns {Promise<Array>} List of available voices
     */
    async getVoices() {
        if (!this.available) {
            throw new Error('ElevenLabs API key not configured');
        }

        try {
            const response = await axios.get(`${this.baseUrl}/voices`, {
                headers: {
                    'xi-api-key': this.apiKey,
                },
            });

            return response.data.voices;
        } catch (error) {
            console.error('Error fetching voices:', error);
            throw new Error('Failed to fetch voices');
        }
    }
}

// Singleton instance
const elevenLabsClient = new ElevenLabsClient();

export default elevenLabsClient;
