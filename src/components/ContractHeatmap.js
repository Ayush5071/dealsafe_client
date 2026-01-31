"use client";

/**
 * Contract Risk Heatmap
 * Visual minimap showing risk distribution across all clauses
 */
export default function ContractHeatmap({ clauses = [], currentClauseId, onClauseClick }) {
    const getRiskColor = (score) => {
        if (score <= 30) return 'bg-green-500';
        if (score <= 60) return 'bg-yellow-500';
        if (score <= 80) return 'bg-orange-500';
        return 'bg-red-500';
    };

    const totalRisk = clauses.reduce((sum, c) => sum + c.riskScore, 0);
    const avgRisk = clauses.length > 0 ? Math.round(totalRisk / clauses.length) : 0;
    const improvedCount = clauses.filter(c => c.improved).length;

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">📊 Contract Risk Map</h3>

            {/* Overall Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-zinc-800 p-4 rounded-lg">
                    <div className="text-sm text-zinc-400 mb-1">Average Risk</div>
                    <div className="text-3xl font-bold text-white">{avgRisk}/100</div>
                </div>
                <div className="bg-zinc-800 p-4 rounded-lg">
                    <div className="text-sm text-zinc-400 mb-1">Improved</div>
                    <div className="text-3xl font-bold text-green-400">
                        {improvedCount}/{clauses.length}
                    </div>
                </div>
            </div>

            {/* Heatmap */}
            <div className="space-y-2">
                <div className="text-sm text-zinc-400 mb-2">Click to jump to clause:</div>
                <div className="grid grid-cols-8 gap-2">
                    {clauses.map((clause, idx) => (
                        <button
                            key={clause.id || idx}
                            onClick={() => onClauseClick && onClauseClick(clause.id)}
                            className={`
                h-12 rounded-lg transition-all
                ${getRiskColor(clause.riskScore)}
                ${currentClauseId === clause.id ? 'ring-2 ring-white scale-110' : 'hover:scale-105'}
                ${clause.improved ? 'opacity-50' : 'opacity-100'}
              `}
                            title={`${clause.name}: ${clause.riskScore}/100 ${clause.improved ? '(Improved)' : ''}`}
                        >
                            <span className="text-xs font-bold text-white">{idx + 1}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-zinc-800">
                <div className="text-sm text-zinc-400 mb-2">Risk Levels:</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500 rounded"></div>
                        <span className="text-zinc-300">Safe (0-30)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                        <span className="text-zinc-300">Caution (31-60)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-orange-500 rounded"></div>
                        <span className="text-zinc-300">High (61-80)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-500 rounded"></div>
                        <span className="text-zinc-300">Critical (81-100)</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
