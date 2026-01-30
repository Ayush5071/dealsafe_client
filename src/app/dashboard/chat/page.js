"use client";
import { useState, useRef, useEffect } from "react";

export default function ChatPage() {
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hello! I'm your AI legal assistant. Ask me anything about your contracts." }
  ]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function send(e) {
    e?.preventDefault();
    if (!q.trim()) return;
    const user = q;
    setMessages((m) => [...m, { from: "user", text: user }]);
    setQ("");
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/query?q=" + encodeURIComponent(user));
      const j = await res.json();
      setMessages((m) => [...m, { from: "bot", text: j.answer || "No answer" }]);
    } catch (err) {
      setMessages((m) => [...m, { from: "bot", text: "Error: " + String(err) }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Legal Chatbot</h2>
        <p className="text-zinc-400 text-sm">Ask questions about your uploaded contracts</p>
      </div>

      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-6 overflow-auto mb-4">
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] p-4 rounded-2xl ${
                  m.from === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-800 text-zinc-100"
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">{m.text}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 text-zinc-100 p-4 rounded-2xl">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                  <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form onSubmit={send} className="flex gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl focus:outline-none focus:border-blue-600"
          placeholder="Ask about this contract..."
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
        >
          {loading ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
