"use client";
import { useState, useEffect } from 'react';

const SUPPORTED_LANGUAGES = {
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

export default function LanguageSelector({ value = 'en', onChange, className = '' }) {
    const [isOpen, setIsOpen] = useState(false);
    const [languages, setLanguages] = useState(SUPPORTED_LANGUAGES);

    useEffect(() => {
        // Fetch languages from API
        fetch('/api/language')
            .then(res => res.json())
            .then(data => {
                if (data.languages) {
                    setLanguages(data.languages);
                }
            })
            .catch(err => console.error('Failed to fetch languages:', err));
    }, []);

    const selectedLang = languages[value] || languages['en'];

    return (
        <div className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white rounded-lg transition-colors"
            >
                <span className="text-xl">{selectedLang.flag}</span>
                <span className="text-sm font-medium">{selectedLang.name}</span>
                <svg
                    className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown */}
                    <div className="absolute top-full left-0 mt-2 w-56 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-20 max-h-96 overflow-y-auto">
                        {Object.entries(languages).map(([code, lang]) => (
                            <button
                                key={code}
                                type="button"
                                onClick={() => {
                                    onChange(code);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-700 transition-colors ${value === code ? 'bg-zinc-700' : ''
                                    }`}
                            >
                                <span className="text-2xl">{lang.flag}</span>
                                <span className="text-sm font-medium text-white">{lang.name}</span>
                                {value === code && (
                                    <svg className="w-4 h-4 ml-auto text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
