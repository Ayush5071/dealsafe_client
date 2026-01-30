export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center space-y-6">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Protect Your Business Deals
          </h1>
          <p className="text-xl text-zinc-400 max-w-3xl mx-auto">
            AI-powered contract analysis for Indian law. Detect risky clauses, understand legal terms, and protect yourself from unfair agreements.
          </p>
          <div className="flex gap-4 justify-center mt-8">
            <a href="/dashboard" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-lg font-semibold transition-all">
              Get Started Free
            </a>
            <a href="#features" className="border border-zinc-700 hover:border-zinc-500 text-white px-8 py-3 rounded-lg font-semibold transition-all">
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-center mb-12">Powerful Contract Analysis</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
            <div className="text-3xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold mb-2">Clause Detection</h3>
            <p className="text-zinc-400">Automatically identify payment, termination, liability, IP, and other critical clauses.</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
            <div className="text-3xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold mb-2">Risk Analysis</h3>
            <p className="text-zinc-400">Get instant risk scores and detect predatory or one-sided terms under Indian law.</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
            <div className="text-3xl mb-4">💬</div>
            <h3 className="text-xl font-semibold mb-2">AI Chatbot</h3>
            <p className="text-zinc-400">Ask questions about your contract and get instant, plain-language explanations.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-800/50 rounded-2xl p-12">
          <h2 className="text-4xl font-bold mb-4">Ready to Analyze Your Contracts?</h2>
          <p className="text-zinc-300 mb-8">Upload your first contract and get a comprehensive risk analysis in seconds.</p>
          <a href="/dashboard" className="inline-block bg-white text-black px-8 py-3 rounded-lg font-semibold hover:bg-zinc-200 transition-all">
            Start Now
          </a>
        </div>
      </section>
    </div>
  );
}
