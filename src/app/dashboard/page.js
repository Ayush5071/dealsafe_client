"use client";
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function DashboardOverview() {
  const { data: session } = useSession();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testingRAG, setTestingRAG] = useState(false);
  const [ragResult, setRagResult] = useState(null);
  const [ragQuery, setRagQuery] = useState('What are the payment terms?');

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      // Fetch real user stats
      const res = await fetch('/api/user/me');
      if (res.ok) {
        const data = await res.json();
        setStats({
          contractsAnalyzed: data.contractsAnalyzed || 0,
          recentActivity: data.recentActivity || [],
          pendingReviews: data.pendingReviews || 0
        });
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  }

  async function testRAGPipeline() {
    setTestingRAG(true);
    setRagResult(null);

    try {
      const res = await fetch('/api/test-rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: ragQuery })
      });

      const data = await res.json();
      setRagResult(data.result);
    } catch (err) {
      alert('Error testing RAG: ' + err.message);
    } finally {
      setTestingRAG(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {session?.user?.name || 'User'}! 👋
        </h1>
        <p className="text-zinc-400">Here's your contract analysis dashboard</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-xl shadow-lg">
          <div className="text-blue-100 text-sm mb-2">Contracts Analyzed</div>
          <div className="text-4xl font-bold text-white">
            {loading ? '...' : stats?.contractsAnalyzed || 0}
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-600 to-green-800 p-6 rounded-xl shadow-lg">
          <div className="text-green-100 text-sm mb-2">Pending Reviews</div>
          <div className="text-4xl font-bold text-white">
            {loading ? '...' : stats?.pendingReviews || 0}
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-purple-800 p-6 rounded-xl shadow-lg">
          <div className="text-purple-100 text-sm mb-2">AI Accuracy</div>
          <div className="text-4xl font-bold text-white">94%</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Link
            href="/dashboard/upload"
            className="bg-blue-600 hover:bg-blue-700 p-4 rounded-lg text-center transition-colors"
          >
            <div className="text-3xl mb-2">📄</div>
            <div className="font-semibold">Upload Contract</div>
          </Link>

          <Link
            href="/dashboard/chat"
            className="bg-green-600 hover:bg-green-700 p-4 rounded-lg text-center transition-colors"
          >
            <div className="text-3xl mb-2">💬</div>
            <div className="font-semibold">Legal Chatbot</div>
          </Link>

          <Link
            href="/dashboard/redesign"
            className="bg-pink-600 hover:bg-pink-700 p-4 rounded-lg text-center transition-colors"
          >
            <div className="text-3xl mb-2">✨</div>
            <div className="font-semibold">Redesign Contract</div>
          </Link>

          <Link
            href="/dashboard/offer-comparison"
            className="bg-purple-600 hover:bg-purple-700 p-4 rounded-lg text-center transition-colors"
          >
            <div className="text-3xl mb-2">⚖️</div>
            <div className="font-semibold">Compare Offers</div>
          </Link>

          <Link
            href="/dashboard/ai-training"
            className="bg-orange-600 hover:bg-orange-700 p-4 rounded-lg text-center transition-colors"
          >
            <div className="text-3xl mb-2">🤖</div>
            <div className="font-semibold">AI Training</div>
          </Link>
        </div>
      </div>

      {/* RAG Pipeline Test (Admin/Dev Feature) */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
        <h2 className="text-xl font-semibold mb-4">🧪 Test RAG Pipeline</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Test the new Retrieval-Augmented Generation pipeline with Human-in-the-Loop fine-tuning
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Test Query</label>
            <input
              type="text"
              value={ragQuery}
              onChange={(e) => setRagQuery(e.target.value)}
              placeholder="Ask a question about a contract..."
              className="w-full bg-zinc-800 border border-zinc-700 text-white px-4 py-2 rounded-lg"
            />
          </div>

          <button
            onClick={testRAGPipeline}
            disabled={testingRAG}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            {testingRAG ? '🔄 Testing...' : '▶️ Run Test'}
          </button>

          {ragResult && (
            <div className="bg-zinc-800 border border-zinc-700 p-4 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Test Results</span>
                <span className={`px-3 py-1 rounded text-sm ${ragResult.status === 'complete' ? 'bg-green-600' : 'bg-red-600'
                  }`}>
                  {ragResult.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-zinc-400">Retrieved Chunks</div>
                  <div className="font-semibold">{ragResult.retrievedChunks}</div>
                </div>
                <div>
                  <div className="text-zinc-400">Confidence</div>
                  <div className="font-semibold">{(ragResult.confidence * 100).toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-zinc-400">Needs Review</div>
                  <div className="font-semibold">{ragResult.needsReview ? 'Yes' : 'No'}</div>
                </div>
              </div>

              {ragResult.analysis && (
                <div className="mt-3">
                  <div className="text-sm text-zinc-400 mb-1">Analysis</div>
                  <div className="bg-zinc-900 p-3 rounded text-sm">
                    {typeof ragResult.analysis === 'string'
                      ? ragResult.analysis
                      : JSON.stringify(ragResult.analysis, null, 2)}
                  </div>
                </div>
              )}

              <Link
                href="/dashboard/ai-training"
                className="inline-block px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm transition-colors"
              >
                View in AI Training Dashboard →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>

        {loading ? (
          <p className="text-zinc-400 text-center py-4">Loading...</p>
        ) : stats?.recentActivity?.length > 0 ? (
          <div className="space-y-3">
            {stats.recentActivity.map((activity, idx) => (
              <div key={idx} className="bg-zinc-800 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-semibold">{activity.title}</div>
                  <div className="text-sm text-zinc-400">{activity.description}</div>
                </div>
                <div className="text-sm text-zinc-500">{activity.time}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-zinc-400">
            <div className="text-4xl mb-2">📭</div>
            <p>No recent activity</p>
            <Link href="/dashboard/upload" className="text-blue-500 hover:underline mt-2 inline-block">
              Upload your first contract
            </Link>
          </div>
        )}
      </div>

      {/* Features Overview */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
        <h2 className="text-xl font-semibold mb-4">Platform Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-zinc-800 p-4 rounded-lg">
            <div className="text-2xl mb-2">🤖</div>
            <h3 className="font-semibold mb-1">AI-Powered Analysis</h3>
            <p className="text-sm text-zinc-400">
              Advanced contract analysis using LangGraph workflows and Qwen AI
            </p>
          </div>

          <div className="bg-zinc-800 p-4 rounded-lg">
            <div className="text-2xl mb-2">🎯</div>
            <h3 className="font-semibold mb-1">Role-Based Insights</h3>
            <p className="text-sm text-zinc-400">
              Personalized analysis for Freelancers, Startups, HR, and more
            </p>
          </div>

          <div className="bg-zinc-800 p-4 rounded-lg">
            <div className="text-2xl mb-2">💼</div>
            <h3 className="font-semibold mb-1">Negotiation Assistant</h3>
            <p className="text-sm text-zinc-400">
              Get specific negotiation tips based on your role and contract
            </p>
          </div>

          <div className="bg-zinc-800 p-4 rounded-lg">
            <div className="text-2xl mb-2">🔍</div>
            <h3 className="font-semibold mb-1">Missing Clause Detection</h3>
            <p className="text-sm text-zinc-400">
              Identify important missing clauses with severity ratings
            </p>
          </div>

          <div className="bg-zinc-800 p-4 rounded-lg">
            <div className="text-2xl mb-2">💬</div>
            <h3 className="font-semibold mb-1">Chat with Contract</h3>
            <p className="text-sm text-zinc-400">
              Ask questions about your contract using RAG-powered chat
            </p>
          </div>

          <div className="bg-zinc-800 p-4 rounded-lg">
            <div className="text-2xl mb-2">📊</div>
            <h3 className="font-semibold mb-1">RAG Pipeline</h3>
            <p className="text-sm text-zinc-400">
              Self-improving AI with admin fine-tuning and learning loop
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
