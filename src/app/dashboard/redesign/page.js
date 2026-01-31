"use client";
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ContractHighlighter from '@/components/ContractHighlighter';
import ClauseComparison from '@/components/ClauseComparison';
import ContractHeatmap from '@/components/ContractHeatmap';
import { saveAs } from 'file-saver';

export default function ContractRedesignPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [contracts, setContracts] = useState([]);
    const [selectedContract, setSelectedContract] = useState(null);
    const [redesign, setRedesign] = useState(null);
    const [loading, setLoading] = useState(false);
    const [currentClauseId, setCurrentClauseId] = useState(null);
    const [acceptedClauses, setAcceptedClauses] = useState(new Set());
    const [viewMode, setViewMode] = useState('comparison'); // 'comparison' or 'heatmap'

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, router]);

    useEffect(() => {
        const fetchContracts = async () => {
            const allContracts = [];
            const uniqueNames = new Set();

            // 1. Fetch from LocalStorage (Local)
            const stored = localStorage.getItem('analyzedContracts');
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    parsed.forEach(c => {
                        if (!uniqueNames.has(c.name)) {
                            allContracts.push({ ...c, source: 'local' });
                            uniqueNames.add(c.name);
                        }
                    });
                } catch (e) {
                    console.error('Failed to load local contracts:', e);
                }
            }

            // 2. Fetch from Database (Server)
            try {
                const res = await fetch('/api/contracts/history');
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && Array.isArray(data.contracts)) {
                        data.contracts.forEach(c => {
                            if (!uniqueNames.has(c.name)) {
                                allContracts.push({ ...c, source: 'cloud' });
                                uniqueNames.add(c.name);
                            }
                        });
                    }
                }
            } catch (e) {
                console.error('Failed to fetch server contracts:', e);
            }

            setContracts(allContracts);
        };

        if (session?.user) {
            fetchContracts();
        }
    }, [session]);

    const handleSelectContract = async (contractName) => {
        setSelectedContract(contractName);
        setLoading(true);
        setRedesign(null);

        try {
            // Generate redesign
            const res = await fetch('/api/redesign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'redesign',
                    filename: contractName
                })
            });

            const data = await res.json();
            if (data.success) {
                setRedesign(data.redesign);
                if (data.redesign.clauses.length > 0) {
                    setCurrentClauseId(data.redesign.clauses[0].id);
                }
            } else {
                alert('Failed to generate redesign: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Redesign error:', error);
            alert('Failed to generate redesign');
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptClause = (clauseId, text) => {
        setAcceptedClauses(prev => new Set([...prev, clauseId]));

        // Update redesign with accepted text
        setRedesign(prev => ({
            ...prev,
            clauses: prev.clauses.map(c =>
                c.id === clauseId ? { ...c, improved: text, accepted: true } : c
            )
        }));
    };

    const handleRejectClause = (clauseId) => {
        setRedesign(prev => ({
            ...prev,
            clauses: prev.clauses.map(c =>
                c.id === clauseId ? { ...c, improved: c.original, rejected: true } : c
            )
        }));
    };

    const handleEditClause = (clauseId, text) => {
        setRedesign(prev => ({
            ...prev,
            clauses: prev.clauses.map(c =>
                c.id === clauseId ? { ...c, improved: text, edited: true } : c
            )
        }));
    };

    const handleExportContract = () => {
        if (!redesign) return;

        // Generate improved contract text
        let improvedContract = `IMPROVED CONTRACT - ${selectedContract}\n\n`;
        improvedContract += `Risk Reduction: ${redesign.originalRisk}/100 → ${redesign.improvedRisk}/100\n`;
        improvedContract += `Improvement: -${redesign.riskReduction} points\n\n`;
        improvedContract += '='.repeat(60) + '\n\n';

        redesign.clauses.forEach((clause, idx) => {
            improvedContract += `${idx + 1}. ${clause.name}\n`;
            improvedContract += '-'.repeat(60) + '\n';
            improvedContract += `${clause.improved}\n\n`;

            if (clause.changes && clause.changes.length > 0) {
                improvedContract += `Changes Made:\n`;
                clause.changes.forEach(change => {
                    improvedContract += `  • ${change}\n`;
                });
                improvedContract += '\n';
            }
        });

        // Save as text file
        const blob = new Blob([improvedContract], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, `improved_${selectedContract}.txt`);
    };

    const getCurrentClause = () => {
        if (!redesign || !currentClauseId) return null;
        return redesign.clauses.find(c => c.id === currentClauseId);
    };

    const currentClause = getCurrentClause();

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-white">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <div className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                ✨ Contract Redesign Studio
                            </h1>
                            <p className="text-sm text-zinc-400 mt-1">
                                Transform risky clauses into safe, balanced agreements
                            </p>
                        </div>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                        >
                            ← Back to Dashboard
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Contract Selection */}
                {!selectedContract && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
                        <h2 className="text-xl font-bold mb-4">Select a Contract to Redesign</h2>

                        {contracts.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-zinc-400 mb-4">No analyzed contracts found</p>
                                <button
                                    onClick={() => router.push('/dashboard/upload')}
                                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                                >
                                    Upload & Analyze Contract
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {contracts.map((contract, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSelectContract(contract.name)}
                                        className="p-6 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-all text-left"
                                    >
                                        <div className="font-semibold text-white mb-2">{contract.name}</div>
                                        <div className="text-sm text-zinc-400">
                                            Risk: {contract.risk || 'N/A'}/100
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-zinc-400">Generating improved contract...</p>
                        </div>
                    </div>
                )}

                {/* Redesign Interface */}
                {redesign && !loading && (
                    <div className="space-y-6">
                        {/* Stats Bar */}
                        <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-xl p-6">
                            <div className="grid grid-cols-4 gap-6">
                                <div>
                                    <div className="text-sm text-zinc-400 mb-1">Original Risk</div>
                                    <div className="text-3xl font-bold text-red-400">{redesign.originalRisk}/100</div>
                                </div>
                                <div>
                                    <div className="text-sm text-zinc-400 mb-1">Improved Risk</div>
                                    <div className="text-3xl font-bold text-green-400">{redesign.improvedRisk}/100</div>
                                </div>
                                <div>
                                    <div className="text-sm text-zinc-400 mb-1">Reduction</div>
                                    <div className="text-3xl font-bold text-purple-400">-{redesign.riskReduction}</div>
                                </div>
                                <div>
                                    <div className="text-sm text-zinc-400 mb-1">Progress</div>
                                    <div className="text-3xl font-bold text-blue-400">
                                        {acceptedClauses.size}/{redesign.clauses.length}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* View Mode Toggle */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setViewMode('comparison')}
                                className={`px-4 py-2 rounded-lg transition-colors ${viewMode === 'comparison'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                    }`}
                            >
                                📊 Comparison View
                            </button>
                            <button
                                onClick={() => setViewMode('heatmap')}
                                className={`px-4 py-2 rounded-lg transition-colors ${viewMode === 'heatmap'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                    }`}
                            >
                                🗺️ Heatmap View
                            </button>
                            <div className="flex-1"></div>
                            <button
                                onClick={handleExportContract}
                                className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <span>💾</span>
                                <span>Export Improved Contract</span>
                            </button>
                        </div>

                        {/* Main Content */}
                        <div className="grid grid-cols-12 gap-6">
                            {/* Sidebar - Heatmap */}
                            <div className="col-span-3">
                                <ContractHeatmap
                                    clauses={redesign.clauses.map(c => ({
                                        id: c.id,
                                        name: c.name,
                                        riskScore: c.originalRisk,
                                        improved: acceptedClauses.has(c.id)
                                    }))}
                                    currentClauseId={currentClauseId}
                                    onClauseClick={setCurrentClauseId}
                                />
                            </div>

                            {/* Main Area */}
                            <div className="col-span-9 space-y-6">
                                {viewMode === 'comparison' && currentClause && (
                                    <ClauseComparison
                                        clauseId={currentClause.id}
                                        clauseName={currentClause.name}
                                        originalText={currentClause.original}
                                        improvedText={currentClause.improved}
                                        originalRisk={currentClause.originalRisk}
                                        improvedRisk={currentClause.improvedRisk}
                                        changes={currentClause.changes}
                                        onAccept={handleAcceptClause}
                                        onReject={handleRejectClause}
                                        onEdit={handleEditClause}
                                    />
                                )}

                                {viewMode === 'heatmap' && (
                                    <div className="space-y-4">
                                        {redesign.clauses.map((clause) => (
                                            <ContractHighlighter
                                                key={clause.id}
                                                text={clause.improved}
                                                riskScore={clause.improvedRisk}
                                                clauseName={clause.name}
                                                recommendations={clause.recommendations}
                                                onEdit={(text) => handleEditClause(clause.id, text)}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Navigation */}
                                {viewMode === 'comparison' && (
                                    <div className="flex justify-between">
                                        <button
                                            onClick={() => {
                                                const idx = redesign.clauses.findIndex(c => c.id === currentClauseId);
                                                if (idx > 0) {
                                                    setCurrentClauseId(redesign.clauses[idx - 1].id);
                                                }
                                            }}
                                            disabled={redesign.clauses.findIndex(c => c.id === currentClauseId) === 0}
                                            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                                        >
                                            ← Previous Clause
                                        </button>
                                        <button
                                            onClick={() => {
                                                const idx = redesign.clauses.findIndex(c => c.id === currentClauseId);
                                                if (idx < redesign.clauses.length - 1) {
                                                    setCurrentClauseId(redesign.clauses[idx + 1].id);
                                                }
                                            }}
                                            disabled={redesign.clauses.findIndex(c => c.id === currentClauseId) === redesign.clauses.length - 1}
                                            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                                        >
                                            Next Clause →
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
