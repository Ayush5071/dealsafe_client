"use client";
import { useState } from 'react';

/**
 * Side-by-Side Clause Comparison
 * Shows original vs improved clause with diff highlighting
 */
export default function ClauseComparison({
    clauseId,
    clauseName,
    originalText,
    improvedText,
    originalRisk,
    improvedRisk,
    changes = [],
    onAccept,
    onReject,
    onEdit
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [customText, setCustomText] = useState(improvedText);

    const getRiskColor = (score) => {
        if (score <= 30) return 'green';
        if (score <= 60) return 'yellow';
        if (score <= 80) return 'orange';
        return 'red';
    };

    const originalColor = getRiskColor(originalRisk);
    const improvedColor = getRiskColor(improvedRisk);

    const colorClasses = {
        green: 'bg-green-500/20 border-green-500',
        yellow: 'bg-yellow-500/20 border-yellow-500',
        orange: 'bg-orange-500/20 border-orange-500',
        red: 'bg-red-500/20 border-red-500'
    };

    const handleAccept = () => {
        if (onAccept) {
            onAccept(clauseId, isEditing ? customText : improvedText);
        }
    };

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleSaveEdit = () => {
        if (onEdit) {
            onEdit(clauseId, customText);
        }
        setIsEditing(false);
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            {/* Header */}
            <div className="mb-4">
                <h3 className="text-xl font-bold text-white mb-2">{clauseName}</h3>
                <div className="flex items-center gap-4 text-sm">
                    <span className="text-zinc-400">Risk Reduction:</span>
                    <span className="font-mono text-red-400">{originalRisk}</span>
                    <span className="text-zinc-500">→</span>
                    <span className="font-mono text-green-400">{improvedRisk}</span>
                    <span className="text-green-400 font-semibold">
                        (-{originalRisk - improvedRisk} points)
                    </span>
                </div>
            </div>

            {/* Side-by-Side Comparison */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Original */}
                <div className={`p-4 rounded-lg border-2 ${colorClasses[originalColor]}`}>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-white">📄 Original</h4>
                        <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full font-bold">
                            {originalRisk}/100
                        </span>
                    </div>
                    <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                        {originalText}
                    </p>
                </div>

                {/* Improved */}
                <div className={`p-4 rounded-lg border-2 ${colorClasses[improvedColor]}`}>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-white">✨ Improved</h4>
                        <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full font-bold">
                            {improvedRisk}/100
                        </span>
                    </div>

                    {!isEditing ? (
                        <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                            {improvedText}
                        </p>
                    ) : (
                        <textarea
                            value={customText}
                            onChange={(e) => setCustomText(e.target.value)}
                            className="w-full p-3 bg-zinc-800 border border-zinc-700 text-white rounded-lg text-sm min-h-[120px] focus:outline-none focus:border-blue-500"
                        />
                    )}
                </div>
            </div>

            {/* Changes List */}
            {changes.length > 0 && (
                <div className="mb-4 p-4 bg-zinc-800 rounded-lg">
                    <h4 className="font-semibold text-white mb-2">🔄 Changes Made:</h4>
                    <ul className="space-y-1">
                        {changes.map((change, idx) => (
                            <li key={idx} className="text-sm text-zinc-300 flex items-start gap-2">
                                <span className="text-green-400">✓</span>
                                <span>{change}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
                {!isEditing ? (
                    <>
                        <button
                            onClick={handleAccept}
                            className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <span>✅</span>
                            <span>Accept Improvement</span>
                        </button>
                        <button
                            onClick={handleEdit}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                        >
                            <span>✏️</span>
                            <span>Edit</span>
                        </button>
                        <button
                            onClick={() => onReject && onReject(clauseId)}
                            className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                        >
                            <span>❌</span>
                            <span>Keep Original</span>
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={handleSaveEdit}
                            className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                        >
                            💾 Save Custom Version
                        </button>
                        <button
                            onClick={() => {
                                setCustomText(improvedText);
                                setIsEditing(false);
                            }}
                            className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
