"use client";
import { useState } from 'react';

export default function ContractActions({ uploadResult, analysis, contractText }) {
    const [showNegotiation, setShowNegotiation] = useState(false);
    const [negotiationData, setNegotiationData] = useState(null);
    const [loadingNegotiation, setLoadingNegotiation] = useState(false);

    const [showMissingClauses, setShowMissingClauses] = useState(false);
    const [missingClausesData, setMissingClausesData] = useState(null);
    const [loadingMissingClauses, setLoadingMissingClauses] = useState(false);

    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [loadingChat, setLoadingChat] = useState(false);

    async function handleNegotiation() {
        setLoadingNegotiation(true);
        try {
            const res = await fetch('/api/negotiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: uploadResult.filename,
                    contractText: contractText || 'Contract text not available'
                }),
            });

            const data = await res.json();
            setNegotiationData(data);
            setShowNegotiation(true);
        } catch (err) {
            alert('Failed to generate negotiation tips: ' + err.message);
        } finally {
            setLoadingNegotiation(false);
        }
    }

    async function handleMissingClauses() {
        setLoadingMissingClauses(true);
        try {
            const res = await fetch('/api/missing-clauses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractText: contractText || 'Contract text not available'
                }),
            });

            const data = await res.json();
            setMissingClausesData(data);
            setShowMissingClauses(true);
        } catch (err) {
            alert('Failed to detect missing clauses: ' + err.message);
        } finally {
            setLoadingMissingClauses(false);
        }
    }

    async function handleChatSubmit(e) {
        e.preventDefault();
        if (!chatInput.trim() || !uploadResult?.filename) return;

        const userMessage = { role: 'user', content: chatInput };
        setChatMessages(prev => [...prev, userMessage]);
        setChatInput('');
        setLoadingChat(true);

        try {
            const res = await fetch('/api/contract-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: uploadResult.filename,
                    question: chatInput,
                    conversationHistory: chatMessages
                }),
            });

            const data = await res.json();
            const assistantMessage = { role: 'assistant', content: data.answer };
            setChatMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            const errorMessage = { role: 'assistant', content: 'Sorry, I encountered an error: ' + err.message };
            setChatMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoadingChat(false);
        }
    }

    if (!uploadResult || !analysis) return null;

    return (
        <div className="space-y-6 mt-6">
            {/* Action Buttons */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                <h3 className="text-lg font-semibold mb-4">Contract Tools</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                        onClick={handleNegotiation}
                        disabled={loadingNegotiation}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded-lg transition-colors"
                    >
                        {loadingNegotiation ? '⏳ Generating...' : '💼 Get Negotiation Tips'}
                    </button>

                    <button
                        onClick={handleMissingClauses}
                        disabled={loadingMissingClauses}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-zinc-700 text-white rounded-lg transition-colors"
                    >
                        {loadingMissingClauses ? '⏳ Analyzing...' : '🔍 Find Missing Clauses'}
                    </button>
                </div>
            </div>

            {/* Chat with Contract */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                <h3 className="text-lg font-semibold mb-4">💬 Chat with Your Contract</h3>

                {/* Chat Messages */}
                <div className="bg-zinc-800 rounded-lg p-4 mb-4 max-h-96 overflow-y-auto space-y-3">
                    {chatMessages.length === 0 ? (
                        <p className="text-zinc-400 text-sm text-center">Ask any question about your contract...</p>
                    ) : (
                        chatMessages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] px-4 py-2 rounded-lg ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-zinc-700 text-zinc-100'
                                    }`}>
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                </div>
                            </div>
                        ))
                    )}
                    {loadingChat && (
                        <div className="flex justify-start">
                            <div className="bg-zinc-700 px-4 py-2 rounded-lg">
                                <p className="text-sm text-zinc-300">Thinking...</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Chat Input */}
                <form onSubmit={handleChatSubmit} className="flex gap-2">
                    <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ask about payment terms, clauses, obligations..."
                        className="flex-1 bg-zinc-800 border border-zinc-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500"
                        disabled={loadingChat}
                    />
                    <button
                        type="submit"
                        disabled={loadingChat || !chatInput.trim()}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded-lg transition-colors"
                    >
                        Send
                    </button>
                </form>
            </div>

            {/* Negotiation Modal */}
            {showNegotiation && negotiationData && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-2xl font-bold">💼 Negotiation Tips</h2>
                                <p className="text-zinc-400 text-sm mt-1">For {negotiationData.role}</p>
                            </div>
                            <button
                                onClick={() => setShowNegotiation(false)}
                                className="text-zinc-400 hover:text-white text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="space-y-4">
                            {negotiationData.suggestions?.map((tip, idx) => (
                                <div key={idx} className="bg-zinc-800 border border-zinc-700 p-4 rounded-lg">
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="font-semibold text-lg">{tip.title}</h3>
                                        <span className={`px-2 py-1 rounded text-xs ${tip.priority === 'High' ? 'bg-red-600' :
                                                tip.priority === 'Medium' ? 'bg-yellow-600' :
                                                    'bg-green-600'
                                            }`}>
                                            {tip.priority} Priority
                                        </span>
                                    </div>
                                    <p className="text-sm text-zinc-300 mb-2"><strong>Issue:</strong> {tip.weakPoint}</p>
                                    <p className="text-sm text-zinc-300 mb-2"><strong>Impact:</strong> {tip.impact}</p>
                                    <div className="bg-zinc-900 p-3 rounded mt-2">
                                        <p className="text-sm text-blue-300"><strong>💡 Negotiation Tip:</strong></p>
                                        <p className="text-sm text-zinc-200 mt-1">{tip.negotiationTip}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Missing Clauses Modal */}
            {showMissingClauses && missingClausesData && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-2xl font-bold">🔍 Missing Clauses</h2>
                                <p className="text-zinc-400 text-sm mt-1">
                                    {missingClausesData.contractType} Contract • {missingClausesData.totalMissing} missing
                                </p>
                            </div>
                            <button
                                onClick={() => setShowMissingClauses(false)}
                                className="text-zinc-400 hover:text-white text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="space-y-4">
                            {missingClausesData.missingClauses?.map((clause, idx) => (
                                <div key={idx} className="bg-zinc-800 border border-zinc-700 p-4 rounded-lg">
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="font-semibold text-lg">{clause.clauseName}</h3>
                                        <span className={`px-2 py-1 rounded text-xs ${clause.severity === 'Critical' ? 'bg-red-600' :
                                                clause.severity === 'High' ? 'bg-orange-600' :
                                                    clause.severity === 'Medium' ? 'bg-yellow-600' :
                                                        'bg-blue-600'
                                            }`}>
                                            {clause.severity}
                                        </span>
                                    </div>
                                    <p className="text-sm text-zinc-300 mb-2"><strong>Why Important:</strong> {clause.reason}</p>
                                    <p className="text-sm text-zinc-300 mb-2"><strong>Potential Impact:</strong> {clause.impact}</p>
                                    <div className="bg-zinc-900 p-3 rounded mt-2">
                                        <p className="text-sm text-green-300"><strong>📝 Suggested Clause:</strong></p>
                                        <p className="text-sm text-zinc-200 mt-1 italic">{clause.suggestedClause}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
