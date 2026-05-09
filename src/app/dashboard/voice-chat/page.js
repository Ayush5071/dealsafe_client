"use client";
import { useState, useEffect, useRef } from 'react';
import { getSpeechAgent, isSpeechRecognitionSupported } from '@/lib/speechAgent';

export default function VoiceChatPage() {
    const [status, setStatus] = useState('idle'); // idle, listening, processing, speaking, error
    const [transcript, setTranscript] = useState('');
    const [lastResponse, setLastResponse] = useState('');
    const [error, setError] = useState(null);
    const [supported, setSupported] = useState(false);

    // Canvas ref for audio visualizer (simplified for now)
    const canvasRef = useRef(null);

    const agent = getSpeechAgent();

    useEffect(() => {
        setSupported(isSpeechRecognitionSupported());

        // Cleanup on unmount
        return () => {
            if (agent) {
                agent.stopListening();
                agent.stopSpeaking();
            }
        };
    }, []);

    const startSession = async () => {
        if (!supported) return;

        setError(null);
        setStatus('listening');
        setTranscript('');

        try {
            await agent.startListening({
                onTranscript: (text, isFinal) => {
                    setTranscript(text);
                    // We don't need to manually setStatus here as much, 
                    // but we can keep it for interim feedback if needed.
                    // onStatusChange handles the main state transitions.
                },
                onResponse: (responseText) => {
                    setLastResponse(responseText);
                },
                onError: (err) => {
                    setError(err);
                    setStatus('error');
                },
                onStatusChange: (newStatus) => {
                    setStatus(newStatus);
                },
                continuous: true // Enable continuous conversation
            });
        } catch (err) {
            setError(err.message);
            setStatus('error');
        }
    };

    const stopSession = () => {
        agent.stopListening();
        agent.stopSpeaking();
        setStatus('idle');
    };

    if (!supported) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-4">
                <div className="bg-red-900/20 border border-red-700 p-6 rounded-xl text-center max-w-md">
                    <h2 className="text-xl font-bold mb-2">Browser Not Supported</h2>
                    <p className="text-zinc-300">Your browser does not support the Web Speech API required for voice chat. Please try Chrome, Edge, or Safari.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-[calc(100dvh-4rem)] md:h-[calc(100vh-4rem)] bg-zinc-950 text-white">
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-zinc-900 flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Voice Intelligence</h1>
                    <p className="text-zinc-500 text-xs md:text-sm">Talk to your contracts</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 relative overflow-y-auto">

                {/* Visualizer / Status Circle */}
                <div className="relative mb-8 md:mb-12 shrink-0">
                    {/* Ambient Glow */}
                    <div className={`absolute inset-0 rounded-full blur-3xl transition-all duration-1000 ${status === 'listening' ? 'bg-purple-600/30 scale-150' :
                        status === 'processing' ? 'bg-blue-600/30 scale-125' :
                            status === 'speaking' ? 'bg-green-600/30 scale-150' :
                                'bg-zinc-800/10 scale-100'
                        }`}></div>

                    {/* Main Circle */}
                    <button
                        onClick={status === 'idle' || status === 'error' ? startSession : stopSession}
                        className={`relative z-10 w-32 h-32 md:w-48 md:h-48 rounded-full flex items-center justify-center border-4 transition-all duration-500 hover:scale-105 active:scale-95 ${status === 'listening' ? 'border-purple-500 bg-purple-950/20 shadow-[0_0_50px_rgba(168,85,247,0.4)] animate-pulse' :
                            status === 'processing' ? 'border-blue-500 bg-blue-950/20 shadow-[0_0_50px_rgba(59,130,246,0.4)] animate-spin-slow' :
                                status === 'speaking' ? 'border-green-500 bg-green-950/20 shadow-[0_0_50px_rgba(34,197,94,0.4)]' :
                                    'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
                            }`}
                    >
                        {status === 'idle' && <span className="text-4xl md:text-5xl">🎙️</span>}
                        {status === 'listening' && <span className="text-4xl md:text-5xl">👂</span>}
                        {status === 'processing' && <span className="text-4xl md:text-5xl">⚡</span>}
                        {status === 'speaking' && <span className="text-4xl md:text-5xl">🗣️</span>}
                        {status === 'error' && <span className="text-4xl md:text-5xl">⚠️</span>}
                    </button>

                    {/* Status Label */}
                    <div className="absolute -bottom-12 md:-bottom-16 left-0 right-0 text-center">
                        <div className={`text-base md:text-lg font-semibold tracking-wide uppercase ${status === 'listening' ? 'text-purple-400' :
                            status === 'processing' ? 'text-blue-400' :
                                status === 'speaking' ? 'text-green-400' :
                                    status === 'error' ? 'text-red-400' :
                                        'text-zinc-500'
                            }`}>
                            {status === 'idle' ? 'Tap to Speak' : status}
                        </div>
                    </div>
                </div>

                {/* Transcripts */}
                <div className="w-full max-w-2xl space-y-4 md:space-y-6 text-center z-10 transition-all px-2">
                    {transcript && (
                        <div className={`transition-all duration-500 ${status === 'listening' ? 'opacity-100 scale-100' : 'opacity-70 scale-95'}`}>
                            <p className="text-zinc-400 text-xs md:text-sm mb-2 uppercase tracking-wider">You said</p>
                            <p className="text-xl md:text-2xl font-light text-white leading-relaxed">"{transcript}"</p>
                        </div>
                    )}

                    {lastResponse && status !== 'listening' && status !== 'processing' && (
                        <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-zinc-800 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <p className="text-green-400 text-xs md:text-sm mb-2 uppercase tracking-wider">Lawyer Sam</p>
                            <p className="text-lg md:text-xl text-zinc-200 leading-relaxed max-w-xl mx-auto">{lastResponse}</p>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-4 bg-red-900/20 border border-red-800 rounded text-red-300">
                            Error: {error}
                        </div>
                    )}
                </div>

            </div>

            {/* Footer Hints */}
            <div className="p-4 md:p-6 text-center text-zinc-600 text-xs md:text-sm shrink-0">
                Try asking: "What is the termination period?" or "Is there a non-compete clause?"
            </div>
        </div>
    );
}
