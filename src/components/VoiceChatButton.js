"use client";
import { useState, useEffect } from 'react';
import { getSpeechAgent, isSpeechRecognitionSupported } from '@/lib/speechAgent';

export default function VoiceChatButton({ language = 'en', onTranscript, onResponse }) {
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isGreeting, setIsGreeting] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [supported, setSupported] = useState(false);
    const [error, setError] = useState(null);

    const agent = getSpeechAgent();

    useEffect(() => {
        setSupported(isSpeechRecognitionSupported());
    }, []);

    useEffect(() => {
        if (agent) {
            agent.setLanguage(language);
        }
    }, [language]);

    const startVoiceChat = async () => {
        setError(null);
        setTranscript('');
        setIsGreeting(true);

        try {
            // Play greeting and then start listening
            await agent.startListening(
                (text, isFinal) => {
                    setTranscript(text);
                    if (onTranscript) {
                        onTranscript(text, isFinal);
                    }
                    if (isFinal) {
                        setIsListening(false);
                        setIsSpeaking(true);
                    } else {
                        setIsGreeting(false);
                        setIsListening(true);
                    }
                },
                (response) => {
                    if (onResponse) {
                        onResponse(response);
                    }
                    setIsSpeaking(false);
                },
                (err) => {
                    setError(err);
                    setIsListening(false);
                    setIsSpeaking(false);
                    setIsGreeting(false);
                }
            );
        } catch (err) {
            setError(err.message);
            setIsGreeting(false);
        }
    };

    const stopVoiceChat = () => {
        agent.stopListening();
        agent.stopSpeaking();
        setIsListening(false);
        setIsSpeaking(false);
    };

    if (!supported) {
        return (
            <div className="text-sm text-zinc-500">
                Voice chat not supported in this browser
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
                {!isListening && !isSpeaking && !isGreeting && (
                    <button
                        onClick={startVoiceChat}
                        className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                    >
                        <span>🎤</span>
                        <span>Start Voice Chat</span>
                    </button>
                )}

                {(isListening || isSpeaking || isGreeting) && (
                    <button
                        onClick={stopVoiceChat}
                        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                    >
                        <span>⏹️</span>
                        <span>Stop</span>
                    </button>
                )}

                {isGreeting && (
                    <div className="flex items-center gap-2 text-green-400">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm">Greeting you...</span>
                    </div>
                )}

                {isListening && (
                    <div className="flex items-center gap-2 text-purple-400">
                        <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                        <span className="text-sm">Listening...</span>
                    </div>
                )}

                {isSpeaking && (
                    <div className="flex items-center gap-2 text-blue-400">
                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="text-sm">Speaking...</span>
                    </div>
                )}
            </div>

            {transcript && (
                <div className="bg-zinc-800 p-3 rounded-lg border border-zinc-700">
                    <div className="text-xs text-zinc-400 mb-1">You said:</div>
                    <div className="text-sm text-zinc-200">{transcript}</div>
                </div>
            )}

            {error && (
                <div className="bg-red-900/20 border border-red-700 p-3 rounded-lg">
                    <div className="text-sm text-red-300">Error: {error}</div>
                </div>
            )}
        </div>
    );
}
