"use client";
import { useState } from 'react';

export default function HILUploadPage() {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [pendingReview, setPendingReview] = useState(false);

    async function handleUpload(e) {
        e.preventDefault();
        if (!file) return;

        setUploading(true);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/hil-upload', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (data.success) {
                setResult(data);
                setPendingReview(true);
            } else {
                alert('Upload failed: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold mb-2">🔄 HIL Upload (Human-in-the-Loop)</h1>
                <p className="text-zinc-400">
                    Upload contracts for admin review to fine-tune the AI system
                </p>
            </div>

            {/* Info Box */}
            <div className="bg-blue-900/20 border border-blue-700 p-6 rounded-xl">
                <h3 className="font-semibold text-blue-300 mb-2">How HIL Upload Works</h3>
                <ul className="text-sm text-zinc-300 space-y-2">
                    <li>✓ Upload a contract for AI analysis using RAG pipeline</li>
                    <li>✓ Analysis is sent to admin for review and corrections</li>
                    <li>✓ Admin feedback fine-tunes the vector store and LLM</li>
                    <li>✓ System learns and improves with each review</li>
                    <li>✓ Future analyses become more accurate</li>
                </ul>
            </div>

            {/* Upload Form */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                <h2 className="text-xl font-semibold mb-4">Upload Contract</h2>

                <form onSubmit={handleUpload} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Select PDF Contract
                        </label>
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => setFile(e.target.files[0])}
                            className="w-full bg-zinc-800 border border-zinc-700 text-white px-4 py-3 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={!file || uploading}
                        className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded-lg font-semibold transition-colors"
                    >
                        {uploading ? '⏳ Uploading & Analyzing...' : '📤 Upload for HIL Review'}
                    </button>
                </form>
            </div>

            {/* Results */}
            {result && (
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Analysis Complete</h2>
                        <span className="px-3 py-1 bg-yellow-600 rounded text-sm">
                            ⏳ Pending Admin Review
                        </span>
                    </div>

                    {/* Workflow Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-zinc-800 p-4 rounded-lg">
                            <div className="text-zinc-400 text-sm">Chunks</div>
                            <div className="text-2xl font-bold">{result.workflow?.chunksProcessed || 0}</div>
                        </div>
                        <div className="bg-zinc-800 p-4 rounded-lg">
                            <div className="text-zinc-400 text-sm">Embeddings</div>
                            <div className="text-2xl font-bold">{result.workflow?.embeddingsGenerated || 0}</div>
                        </div>
                        <div className="bg-zinc-800 p-4 rounded-lg">
                            <div className="text-zinc-400 text-sm">Web Sources</div>
                            <div className="text-2xl font-bold">{result.workflow?.webClausesFound || 0}</div>
                        </div>
                        <div className="bg-zinc-800 p-4 rounded-lg">
                            <div className="text-zinc-400 text-sm">Clauses</div>
                            <div className="text-2xl font-bold">{result.workflow?.clausesExtracted || 0}</div>
                        </div>
                    </div>

                    {/* Analysis Preview */}
                    {result.analysis && (
                        <div className="bg-zinc-800 p-4 rounded-lg">
                            <h3 className="font-semibold mb-2">AI Analysis Preview</h3>
                            <div className="text-sm text-zinc-300 space-y-2">
                                {result.analysis.summary && (
                                    <div>
                                        <span className="text-zinc-400">Summary:</span> {result.analysis.summary}
                                    </div>
                                )}
                                {result.analysis.risks && result.analysis.risks.length > 0 && (
                                    <div>
                                        <span className="text-zinc-400">Risks:</span>
                                        <ul className="list-disc list-inside ml-4">
                                            {result.analysis.risks.map((risk, idx) => (
                                                <li key={idx}>{risk}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Clauses with Confidence */}
                    {result.clauses && result.clauses.length > 0 && (
                        <div className="bg-zinc-800 p-4 rounded-lg">
                            <h3 className="font-semibold mb-3">Extracted Clauses</h3>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {result.clauses.slice(0, 5).map((clause, idx) => (
                                    <div key={idx} className="bg-zinc-900 p-3 rounded border border-zinc-700">
                                        <div className="flex items-start justify-between mb-1">
                                            <span className="font-medium text-sm">{clause.name}</span>
                                            <span className={`px-2 py-1 rounded text-xs ${clause.confidence === 100 ? 'bg-green-600' :
                                                    clause.confidence >= 75 ? 'bg-blue-600' :
                                                        'bg-yellow-600'
                                                }`}>
                                                {clause.confidenceBadge}
                                            </span>
                                        </div>
                                        <div className="text-xs text-zinc-400">{clause.category} • {clause.risk} risk</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Admin Review Notice */}
                    <div className="bg-orange-900/20 border border-orange-700 p-4 rounded-lg">
                        <h3 className="font-semibold text-orange-300 mb-2">📋 Next Steps</h3>
                        <p className="text-sm text-zinc-300 mb-3">
                            This analysis has been submitted for admin review. An admin will:
                        </p>
                        <ul className="text-sm text-zinc-300 space-y-1 ml-4">
                            <li>• Review the AI analysis for accuracy</li>
                            <li>• Provide corrections and quality ratings</li>
                            <li>• Fine-tune the vector store with feedback</li>
                            <li>• Improve future AI predictions</li>
                        </ul>
                        <div className="mt-4">
                            <a
                                href="/dashboard/ai-training"
                                className="inline-block px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm transition-colors"
                            >
                                View in AI Training Dashboard →
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* How It Helps */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                <h2 className="text-xl font-semibold mb-4">How This Helps Fine-Tune the System</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-zinc-800 p-4 rounded-lg">
                        <div className="text-2xl mb-2">🎯</div>
                        <h3 className="font-semibold mb-1">Vector Store Improvement</h3>
                        <p className="text-sm text-zinc-400">
                            Admin corrections are re-embedded and stored as high-quality examples for future retrievals
                        </p>
                    </div>

                    <div className="bg-zinc-800 p-4 rounded-lg">
                        <div className="text-2xl mb-2">🧠</div>
                        <h3 className="font-semibold mb-1">LLM Learning</h3>
                        <p className="text-sm text-zinc-400">
                            Feedback patterns help the LLM understand what good analysis looks like
                        </p>
                    </div>

                    <div className="bg-zinc-800 p-4 rounded-lg">
                        <div className="text-2xl mb-2">📊</div>
                        <h3 className="font-semibold mb-1">Quality Metrics</h3>
                        <p className="text-sm text-zinc-400">
                            Track accuracy improvements over time with admin ratings
                        </p>
                    </div>

                    <div className="bg-zinc-800 p-4 rounded-lg">
                        <div className="text-2xl mb-2">🔄</div>
                        <h3 className="font-semibold mb-1">Continuous Improvement</h3>
                        <p className="text-sm text-zinc-400">
                            Each review makes the system smarter for all future analyses
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
