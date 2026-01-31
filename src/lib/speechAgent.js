import { ollamaClient } from './llm';

/**
 * Speech-to-Speech Agent
 * Handles voice conversations using Web Speech API (STT) and ElevenLabs (TTS)
 */

// Check if browser supports speech recognition
export function isSpeechRecognitionSupported() {
    if (typeof window === 'undefined') return false;
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

/**
 * Speech Recognition (STT) - Browser API
 */
export class SpeechToText {
    constructor() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            throw new Error('Speech recognition not supported in this browser');
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.isListening = false;
        this.onResult = null;
        this.onError = null;
        this.onEnd = null;
    }

    setLanguage(lang) {
        // Map our language codes to speech recognition codes
        const langMap = {
            'en': 'en-US',
            'es': 'es-ES',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'hi': 'hi-IN',
            'zh': 'zh-CN',
            'ja': 'ja-JP',
            'ar': 'ar-SA',
            'pt': 'pt-PT',
            'ru': 'ru-RU',
            'it': 'it-IT',
            'ko': 'ko-KR'
        };

        this.recognition.lang = langMap[lang] || 'en-US';
    }

    start(onResult, onError, onEnd) {
        this.onResult = onResult;
        this.onError = onError;
        this.onEnd = onEnd;

        this.recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0].transcript)
                .join('');

            const isFinal = event.results[event.results.length - 1].isFinal;

            if (this.onResult) {
                this.onResult(transcript, isFinal);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (this.onError) {
                this.onError(event.error);
            }
        };

        this.recognition.onend = () => {
            this.isListening = false;
            if (this.onEnd) {
                this.onEnd();
            }
        };

        try {
            this.recognition.start();
            this.isListening = true;
        } catch (error) {
            console.error('Failed to start recognition:', error);
            if (this.onError) {
                this.onError(error.message);
            }
        }
    }

    stop() {
        if (this.isListening) {
            this.recognition.stop();
            this.isListening = false;
        }
    }
}

/**
 * Text-to-Speech using ElevenLabs
 */
export class TextToSpeech {
    constructor() {
        this.audioContext = null;
        this.currentAudio = null;
    }

    async speak(text, language = 'en') {
        try {
            // Call our TTS API
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, language })
            });

            if (!response.ok) {
                throw new Error('TTS request failed');
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            // Stop any currently playing audio
            this.stop();

            // Play the audio
            this.currentAudio = new Audio(audioUrl);

            return new Promise((resolve, reject) => {
                this.currentAudio.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    resolve();
                };

                this.currentAudio.onerror = (error) => {
                    URL.revokeObjectURL(audioUrl);
                    reject(error);
                };

                this.currentAudio.play().catch(reject);
            });
        } catch (error) {
            console.error('TTS error:', error);
            throw error;
        }
    }

    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
    }

    isPlaying() {
        return this.currentAudio && !this.currentAudio.paused;
    }
}

/**
 * Speech-to-Speech Agent
 * Orchestrates STT, LLM processing, and TTS
 */
export class SpeechToSpeechAgent {
    constructor() {
        this.stt = null;
        this.tts = new TextToSpeech();
        this.language = 'en';
        this.conversationHistory = [];
    }

    initialize() {
        if (isSpeechRecognitionSupported()) {
            this.stt = new SpeechToText();
            return true;
        }
        return false;
    }

    setLanguage(lang) {
        this.language = lang;
        if (this.stt) {
            this.stt.setLanguage(lang);
        }
    }

    async greet() {
        const greeting = "Hello, my name is Lawyer Sam. How can I help you today?";
        try {
            await this.tts.speak(greeting, this.language);
        } catch (error) {
            console.error('Greeting error:', error);
        }
    }

    async startListening(onTranscript, onResponse, onError, skipGreeting = false) {
        if (!this.stt) {
            if (onError) onError('Speech recognition not supported');
            return;
        }

        // Play greeting first if not skipped
        if (!skipGreeting) {
            try {
                await this.greet();
            } catch (error) {
                console.warn('Greeting failed, continuing anyway:', error);
            }
        }

        this.stt.start(
            async (transcript, isFinal) => {
                if (onTranscript) {
                    onTranscript(transcript, isFinal);
                }

                if (isFinal) {
                    try {
                        // Process with Qwen
                        const response = await this.processWithLLM(transcript);

                        if (onResponse) {
                            onResponse(response);
                        }

                        // Speak the response
                        await this.tts.speak(response, this.language);
                    } catch (error) {
                        console.error('Processing error:', error);
                        if (onError) {
                            onError(error.message);
                        }
                    }
                }
            },
            onError,
            () => {
                console.log('Speech recognition ended');
            }
        );
    }

    stopListening() {
        if (this.stt) {
            this.stt.stop();
        }
    }

    stopSpeaking() {
        this.tts.stop();
    }

    async processWithLLM(userInput) {
        // Add to conversation history
        this.conversationHistory.push({
            role: 'user',
            content: userInput
        });

        // Keep only last 10 messages
        if (this.conversationHistory.length > 10) {
            this.conversationHistory = this.conversationHistory.slice(-10);
        }

        // Process with Qwen
        const response = await ollamaClient.chat(
            this.conversationHistory,
            'You are a helpful legal assistant. Provide concise, clear answers suitable for voice conversation. Keep responses under 3 sentences when possible.'
        );

        // Add response to history
        this.conversationHistory.push({
            role: 'assistant',
            content: response
        });

        return response;
    }

    clearHistory() {
        this.conversationHistory = [];
    }
}

// Singleton instance
let agentInstance = null;

export function getSpeechAgent() {
    if (!agentInstance) {
        agentInstance = new SpeechToSpeechAgent();
        agentInstance.initialize();
    }
    return agentInstance;
}

export default {
    SpeechToText,
    TextToSpeech,
    SpeechToSpeechAgent,
    getSpeechAgent,
    isSpeechRecognitionSupported
};
