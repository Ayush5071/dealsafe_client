"use client";
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AITrainingPage() {
    const { data: session } = useSession();
    const router = useRouter();

    const [pending, setPending] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedAnalysis, setSelectedAnalysis] = useState(null);
    const [feedback, setFeedback] = useState({
        qualityScore: 5,
        comments: '',
        corrected: {}
    });

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        try {
            const [pendingRes, metricsRes] = await Promise.all([
                fetch('/api/admin/rag-review'),
                fetch('/api/admin/rag-analytics')
            ]);

            if (pendingRes.ok) {
                const data = await pendingRes.json();
                setPending(data.pending || []);
            }

            if (metricsRes.ok) {
                const data = await metricsRes.json();
                setMetrics(data.metrics);
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmitFeedback() {
        if (!selectedAnalysis) return;

        try {
            const res = await fetch('/api/admin/rag-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: selectedAnalysis.source,
                    userId: selectedAnalysis.userId,
                    feedback
                })
            });

            if (res.ok) {
                alert('Feedback submitted successfully!');
                setSelectedAnalysis(null);
                setFeedback({ qualityScore: 5, comments: '', corrected: {} });
                fetchData();
            } else {
                alert('Failed to submit feedback');
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-zinc-400">Loading AI Training Dashboard...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold mb-2">🤖 AI Training Dashboard</h1>
                <p className="text-zinc-400">Review analyses and fine-tune the AI system</p>
            </div>

            {/* Metrics Overview */}
            {metrics && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                        <div className="text-zinc-400 text-sm mb-1">Total Documents</div>
                        <div className="text-3xl font-bold">{metrics.totalDocuments || 0}</div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                        <div className="text-zinc-400 text-sm mb-1">Reviewed</div>
                        <div className="text-3xl font-bold text-green-500">{metrics.reviewedCount || 0}</div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                        <div className="text-zinc-400 text-sm mb-1">Avg Quality</div>
                        <div className="text-3xl font-bold text-blue-500">
                            {metrics.avgQualityScore ? metrics.avgQualityScore.toFixed(1) : 'N/A'}/5
                        </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                        <div className="text-zinc-400 text-sm mb-1">Trend</div>
                        <div className={`text-2xl font-bold ${metrics.improvementTrend === 'improving' ? 'text-green-500' :
                                metrics.improvementTrend === 'declining' ? 'text-red-500' :
                                    'text-yellow-500'
                            }`}>
                            {metrics.improvementTrend === 'improving' ? '📈 Improving' :
                                metrics.improvementTrend === 'declining' ? '📉 Declining' :
                                    '➡️ Stable'}
                        </div>
                    </div>
                </div>
            )}

            {/* Pending Reviews */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                <h2 className="text-xl font-semibold mb-4">
                    Pending Reviews ({pending.length})
                </h2>

                {pending.length === 0 ? (
                    <p className="text-zinc-400 text-center py-8">
                        No pending reviews. Great job! 🎉
                    </p>
                ) : (
                    <div className="space-y-3">
                        {pending.map((item, idx) => (
                            <div
                                key={idx}
                                className="bg-zinc-800 border border-zinc-700 p-4 rounded-lg hover:border-blue-500 transition-colors cursor-pointer"
                                onClick={() => setSelectedAnalysis(item)}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-semibold">{item.source}</h3>
                                        <p className="text-sm text-zinc-400">
                                            User: {item.userId} • {item.chunkCount} chunks
                                        </p>
                                    </div>
                                    <div className="text-sm text-zinc-400">
                                        {new Date(item.uploadedAt).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Review Modal */}
            {selectedAnalysis && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-2xl font-bold">Review Analysis</h2>
                                <p className="text-zinc-400 text-sm mt-1">{selectedAnalysis.source}</p>
                            </div>
                            <button
                                onClick={() => setSelectedAnalysis(null)}
                                className="text-zinc-400 hover:text-white text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Quality Score */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Quality Score (1-5)
                                </label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map(score => (
                                        <button
                                            key={score}
                                            onClick={() => setFeedback({ ...feedback, qualityScore: score })}
                                            className={`px-4 py-2 rounded ${feedback.qualityScore === score
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                                }`}
                                        >
                                            {score} ⭐
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Comments */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Comments / Corrections
                                </label>
                                <textarea
                                    value={feedback.comments}
                                    onChange={(e) => setFeedback({ ...feedback, comments: e.target.value })}
                                    placeholder="Provide feedback on what was correct or what needs improvement..."
                                    className="w-full bg-zinc-800 border border-zinc-700 text-white px-4 py-3 rounded-lg min-h-32"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setSelectedAnalysis(null)}
                                    className="px-6 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitFeedback}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                                >
                                    Submit Feedback
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
