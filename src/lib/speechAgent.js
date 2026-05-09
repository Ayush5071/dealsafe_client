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
        if (typeof window !== 'undefined') {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                this.recognition = new SpeechRecognition();
                this.recognition.continuous = true;
                this.recognition.interimResults = true;
                this.recognition.lang = 'en-US';
            }
        }

        this.isListening = false;
        this.onResult = null;
        this.onError = null;
        this.onEnd = null;
        this.silenceTimer = null;
        this.finalTranscript = '';
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

        if (this.recognition) {
            this.recognition.lang = langMap[lang] || 'en-US';
        }
    }

    start(onResult, onError, onEnd) {
        if (!this.recognition) {
            if (onError) onError('Speech recognition not supported');
            return;
        }

        this.onResult = onResult;
        this.onError = onError;
        this.onEnd = onEnd;
        this.finalTranscript = '';

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    this.finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            const currentFullTranscript = this.finalTranscript + interimTranscript;

            if (this.onResult) {
                this.onResult(currentFullTranscript, false);
            }

            if (this.silenceTimer) clearTimeout(this.silenceTimer);

            if (currentFullTranscript.trim().length > 0) {
                this.silenceTimer = setTimeout(() => {
                    this.stop();
                    if (this.onResult) {
                        this.onResult(this.finalTranscript || currentFullTranscript, true);
                    }
                }, 2000);
            }
        };

        this.recognition.onerror = (event) => {
            if (event.error === 'no-speech') {
                // ignore
            } else {
                console.error('Speech recognition error:', event.error);
                if (this.onError) this.onError(event.error);
            }
        };

        this.recognition.onend = () => {
            if (this.silenceTimer) clearTimeout(this.silenceTimer);
            this.isListening = false;
            if (this.onEnd) this.onEnd();
        };

        try {
            this.recognition.start();
            this.isListening = true;
        } catch (error) {
            console.error('Failed to start recognition:', error);
            if (this.onError) this.onError(error.message);
        }
    }

    stop() {
        if (this.isListening && this.recognition) {
            if (this.silenceTimer) clearTimeout(this.silenceTimer);
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

            this.stop();
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
        const greeting = "Hello, I am ready to help you with your contracts. What would you like to know?";
        try {
            await this.tts.speak(greeting, this.language);
        } catch (error) {
            console.error('Greeting error:', error);
        }
    }

    // New version accepting an object for better flexibility
    async startListening(params) {
        // Handle legacy call signature (arguments: onTranscript, onResponse, onError, skipGreeting)
        if (typeof params === 'function') {
            const [onTranscript, onResponse, onError, skipGreeting] = arguments;
            params = { onTranscript, onResponse, onError, skipGreeting, continuous: false };
        }

        const {
            onTranscript,
            onResponse,
            onError,
            onStatusChange, // new callback: (status: 'listening' | 'processing' | 'speaking') => void
            skipGreeting = false,
            continuous = false
        } = params;

        this.shouldContinue = continuous;

        if (!this.stt) {
            if (onError) onError('Speech recognition not supported');
            return;
        }

        if (!skipGreeting) {
            try {
                if (onStatusChange) onStatusChange('speaking');
                await this.greet();
            } catch (error) {
                console.warn('Greeting failed, continuing anyway:', error);
            }
        }

        const runTurn = () => {
            if (!this.shouldContinue && params._isRecursive) return; // Stop if cancelled

            if (onStatusChange) onStatusChange('listening');

            this.stt.start(
                async (transcript, isFinal) => {
                    if (onTranscript) {
                        onTranscript(transcript, isFinal);
                    }

                    if (isFinal) {
                        try {
                            if (onStatusChange) onStatusChange('processing');

                            const response = await this.processWithLLM(transcript);

                            if (onResponse) {
                                onResponse(response);
                            }

                            if (onStatusChange) onStatusChange('speaking');
                            await this.tts.speak(response, this.language);

                            // Prepare for next turn if continuous
                            if (this.shouldContinue) {
                                // Recursive call for next turn
                                // We pass _isRecursive to avoid re-greeting or re-setting flags unnecessarily
                                // But simpler is just to loop logic. 
                                // Since stt.start is callback based, we just call runTurn() again.
                                runTurn();
                            } else {
                                if (onStatusChange) onStatusChange('idle');
                            }

                        } catch (error) {
                            console.error('Processing error:', error);
                            if (onError) {
                                onError(error.message);
                            }
                            if (onStatusChange) onStatusChange('error');
                        }
                    }
                },
                onError,
                () => {
                    console.log('Speech recognition ended');
                }
            );
        };

        runTurn();
    }

    stopSession() {
        this.shouldContinue = false;
        this.stopListening();
        this.stopSpeaking();
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

        if (this.conversationHistory.length > 6) {
            this.conversationHistory = this.conversationHistory.slice(-6);
        }

        try {
            const res = await fetch('/api/voice-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: userInput,
                    conversationHistory: this.conversationHistory
                })
            });

            if (!res.ok) throw new Error("Voice chat API failed");

            const json = await res.json();
            const response = json.answer || "I'm sorry, I couldn't find an answer.";

            // Add response to history
            this.conversationHistory.push({
                role: 'assistant',
                content: response
            });

            return response;

        } catch (err) {
            console.error("LLM Process error", err);
            return "I am having trouble connecting to the server. Please try again.";
        }
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
