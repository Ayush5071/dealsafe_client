"use client";
import { useState } from 'react';

/**
 * Contract Text Highlighter with Risk-Based Color Coding
 * Colors: Green (safe), Yellow (caution), Orange (high risk), Red (critical)
 */
export default function ContractHighlighter({
    text,
    riskScore = 0,
    riskLevel = 'low',
    clauseName = '',
    recommendations = [],
    onEdit
}) {
    const [showTooltip, setShowTooltip] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(text);

    // Determine color based on risk score
    const getRiskColor = () => {
        if (riskScore <= 30) return 'green';
        if (riskScore <= 60) return 'yellow';
        if (riskScore <= 80) return 'orange';
        return 'red';
    };

    const color = getRiskColor();

    const colorClasses = {
        green: 'bg-green-500/10 border-green-500 hover:bg-green-500/20',
        yellow: 'bg-yellow-500/10 border-yellow-500 hover:bg-yellow-500/20',
        orange: 'bg-orange-500/10 border-orange-500 hover:bg-orange-500/20',
        red: 'bg-red-500/10 border-red-500 hover:bg-red-500/20'
    };

    const badgeClasses = {
        green: 'bg-green-500 text-white',
        yellow: 'bg-yellow-500 text-black',
        orange: 'bg-orange-500 text-white',
        red: 'bg-red-500 text-white'
    };

    const handleSave = () => {
        if (onEdit) {
            onEdit(editedText);
        }
        setIsEditing(false);
    };

    return (
        <div className="relative">
            <div
                className={`p-4 rounded-lg border-2 transition-all ${colorClasses[color]} cursor-pointer`}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                {/* Clause Header */}
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-white">{clauseName || 'Clause'}</h3>
                    <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeClasses[color]}`}>
                            Risk: {riskScore}/100
                        </span>
                        {!isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
                            >
                                ✏️ Edit
                            </button>
                        )}
                    </div>
                </div>

                {/* Clause Text */}
                {!isEditing ? (
                    <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap">
                        {text}
                    </p>
                ) : (
                    <div className="space-y-2">
                        <textarea
                            value={editedText}
                            onChange={(e) => setEditedText(e.target.value)}
                            className="w-full p-3 bg-zinc-800 border border-zinc-700 text-white rounded-lg text-sm min-h-[100px] focus:outline-none focus:border-blue-500"
                            placeholder="Edit clause text..."
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                            >
                                ✅ Save
                            </button>
                            <button
                                onClick={() => {
                                    setEditedText(text);
                                    setIsEditing(false);
                                }}
                                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg transition-colors"
                            >
                                ❌ Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Tooltip with Recommendations */}
                {showTooltip && recommendations.length > 0 && !isEditing && (
                    <div className="absolute z-10 mt-2 p-4 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-w-md">
                        <h4 className="font-semibold text-white mb-2">💡 Recommendations:</h4>
                        <ul className="space-y-1">
                            {recommendations.map((rec, idx) => (
                                <li key={idx} className="text-sm text-zinc-300 flex items-start gap-2">
                                    <span className="text-blue-400">•</span>
                                    <span>{rec}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
