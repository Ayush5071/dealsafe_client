export default function DashboardHome() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Welcome to DealSafe</h1>
        <p className="text-zinc-400">Analyze contracts and protect your business with AI-powered legal insights.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
          <div className="text-2xl mb-2">📊</div>
          <h3 className="text-xl font-semibold mb-1">0</h3>
          <p className="text-zinc-400 text-sm">Contracts Analyzed</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
          <div className="text-2xl mb-2">⚠️</div>
          <h3 className="text-xl font-semibold mb-1">0</h3>
          <p className="text-zinc-400 text-sm">High Risk Clauses Detected</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
          <div className="text-2xl mb-2">✅</div>
          <h3 className="text-xl font-semibold mb-1">0</h3>
          <p className="text-zinc-400 text-sm">Contracts Reviewed</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <a href="/dashboard/upload" className="bg-blue-600 hover:bg-blue-700 p-4 rounded-lg transition-colors">
            <div className="text-lg font-semibold">📄 Upload New Contract</div>
            <p className="text-sm text-blue-100 mt-1">Analyze a contract for risks and clauses</p>
          </a>
          <a href="/dashboard/chat" className="bg-purple-600 hover:bg-purple-700 p-4 rounded-lg transition-colors">
            <div className="text-lg font-semibold">💬 Chat with AI</div>
            <p className="text-sm text-purple-100 mt-1">Ask questions about your contracts</p>
          </a>
        </div>
      </div>
    </div>
  );
}
