"use client";
import { useState, useRef, useEffect } from "react";
import HILStatusChecker from '@/components/HILStatusChecker';
import UserFeedbackWidget from '@/components/UserFeedbackWidget';
import VoiceChatButton from '@/components/VoiceChatButton';
import LanguageSelector from '@/components/LanguageSelector';

export default function ChatPage() {
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hello! I'm your AI legal assistant. Ask me anything about your contracts." }
  ]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Options
  const indiaOnly = true; // India-only by default (no checkbox)
  const [debug, setDebug] = useState(false);
  const [legalInfo, setLegalInfo] = useState(null);

  // Multilingual support
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [supportedLanguages, setSupportedLanguages] = useState({});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const [isAdmin, setIsAdmin] = useState(false);
  const [hilPending, setHilPending] = useState(false);
  const [hilData, setHilData] = useState(null);
  const [lastResponseMeta, setLastResponseMeta] = useState(null);

  useEffect(() => {
    // Fetch role info to see if current user is admin/expert
    (async () => {
      try {
        const r = await fetch('/api/user/role');
        if (r.ok) {
          const j = await r.json();
          setIsAdmin(!!j.isAdmin || !!j.isExpert);
        }
      } catch (e) {
        // ignore
      }
    })();

    // Fetch supported languages
    (async () => {
      try {
        const r = await fetch('/api/language');
        if (r.ok) {
          const j = await r.json();
          setSupportedLanguages(j.languages || {});
        }
      } catch (e) {
        console.error('Failed to fetch languages:', e);
      }
    })();
  }, []);

  useEffect(() => {
    // Fetch role info to see if current user is admin/expert
    (async () => {
      try {
        const r = await fetch('/api/user/role');
        if (r.ok) {
          const j = await r.json();
          setIsAdmin(!!j.isAdmin || !!j.isExpert);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  async function send(e) {
    e?.preventDefault();
    if (!q.trim()) return;
    const user = q;
    setMessages((m) => [...m, { from: "user", text: user }]);
    setQ("");
    setLoading(true);
    setLegalInfo(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: user,
          india_only: true,
          debug,
          language: selectedLanguage // Add language preference
        })
      });
      const j = await res.json();

      // If HIL pending, display pending message and HIL status checker
      if (j.hil_mandatory) {
        setMessages((m) => [...m, { from: "bot", text: 'Answer pending expert review. You will be notified when complete.' }]);
        setHilPending(true);
        setHilData({ hil_id: j.hil_id, analysis_id: j.analysis_id });
        setLegalInfo(null);
        // Stop further processing
        return;
      }

      setMessages((m) => [...m, { from: "bot", text: j.answer || "No answer" }]);
      if (j.legal) setLegalInfo(j.legal);
      else setLegalInfo(null);

      // Keep metadata for feedback widget
      setLastResponseMeta({ analysisId: j.analysis_id || `chat_${Date.now()}`, documentName: 'chat', originalAnalysis: { answer: j.answer }, feedbackId: j.feedback_id || null, expert_mode: !!j.expert_mode });

      // If a feedback entry was created and current user is admin/expert but expert_mode flagged, show inline expert controls
      if (j.feedback_id && isAdmin) {
        if (j.expert_mode) {
          // Expert mode: notify inline (UI shows approve/reject controls)
          setMessages((m) => [...m, { from: 'bot', text: '(Expert mode: You can Approve or Request Reanalysis)' }]);
        } else {
          if (confirm('A human review is requested for this chat answer. Open Expert Review?')) {
            window.location.href = `/dashboard/expert-review?feedbackId=${encodeURIComponent(j.feedback_id)}`;
          }
        }
      }
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

      {/* Voice Chat Section */}
      <div className="mb-4 bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
        <VoiceChatButton
          language={selectedLanguage}
          onTranscript={(text, isFinal) => {
            if (isFinal) {
              setMessages((m) => [...m, { from: "user", text }]);
            }
          }}
          onResponse={(response) => {
            setMessages((m) => [...m, { from: "bot", text: response }]);
          }}
        />
      </div>

      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-6 overflow-auto mb-4">
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] p-4 rounded-2xl ${m.from === "user"
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

          {legalInfo && (
            <div className="mt-4 bg-zinc-800 p-4 rounded-lg border border-zinc-700 text-sm">
              <h4 className="font-semibold mb-2">Detected legal references</h4>
              {legalInfo.laws && legalInfo.laws.length > 0 && (
                <div className="mb-2">
                  <div className="text-zinc-400 text-xs">Laws:</div>
                  <ul className="list-disc ml-5">
                    {legalInfo.laws.map((l, idx) => (
                      <li key={idx} className="mt-1">{l.law} — {l.occurrences.length} occurrence(s)</li>
                    ))}
                  </ul>
                </div>
              )}

              {legalInfo.clauses && legalInfo.clauses.length > 0 && (
                <div>
                  <div className="text-zinc-400 text-xs">Clause categories detected:</div>
                  <ul className="list-disc ml-5">
                    {legalInfo.clauses.map((c, idx) => (
                      <li key={idx} className="mt-1"><strong>{c.category}</strong>
                        <div className="text-xs text-zinc-400 mt-1">{c.occurrences.map(o => `${o.source} (chunk ${o.chunk || o.chunk})`).join(', ')}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* User feedback widget for the latest chat response */}
              {lastResponseMeta && (
                <div className="mt-3">
                  <UserFeedbackWidget
                    analysis={lastResponseMeta.originalAnalysis}
                    analysisId={lastResponseMeta.analysisId}
                    documentName={lastResponseMeta.documentName}
                    onSubmitted={(fb) => { alert('Thanks for the feedback'); }}
                  />

                  {/* Expert quick actions when expert_mode is enabled */}
                  {isAdmin && lastResponseMeta.feedbackId && lastResponseMeta.expert_mode && (
                    <div className="mt-3 flex gap-2 items-center">
                      <button className="px-3 py-1 bg-green-600 rounded" onClick={async () => {
                        try {
                          const res = await fetch('/api/expert/chat-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feedback_id: lastResponseMeta.feedbackId, action: 'approve', comments: '' }) });
                          const j = await res.json();
                          if (!res.ok) return alert('Approve failed: ' + (j.error || 'unknown'));
                          const msg = j.hil_vectorized ? `Approved. Training applied. Vectors added: ${j.last_training_metrics?.vectors_added ?? 'N/A'}` : 'Approved.';
                          alert(msg);
                        } catch (e) { console.error(e); alert('Failed to approve'); }
                      }}>Approve</button>

                      <button className="px-3 py-1 bg-yellow-600 rounded" onClick={async () => {
                        const reason = prompt('Please add comments for reanalysis (optional)') || '';
                        try {
                          const res = await fetch('/api/expert/chat-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feedback_id: lastResponseMeta.feedbackId, action: 'request_reanalysis', comments: reason }) });
                          const j = await res.json();
                          if (!res.ok) return alert('Reanalysis failed: ' + (j.error || 'unknown'));
                          // Append reanalysis result to chat
                          if (j.reanalysis_result && j.reanalysis_result.answer) {
                            setMessages((m) => [...m, { from: 'bot', text: j.reanalysis_result.answer }]);
                            // Update lastResponseMeta with new answer text
                            setLastResponseMeta((prev) => ({ ...(prev || {}), originalAnalysis: { answer: j.reanalysis_result.answer } }));
                          }
                        } catch (e) { console.error(e); alert('Failed to request reanalysis'); }
                      }}>Request Reanalysis</button>

                      <button className="px-3 py-1 bg-red-600 rounded" onClick={async () => {
                        const reason = prompt('Please add rejection comments (optional)') || '';
                        try {
                          const res = await fetch('/api/expert/chat-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feedback_id: lastResponseMeta.feedbackId, action: 'reject', comments: reason }) });
                          const j = await res.json();
                          if (!res.ok) return alert('Reject failed: ' + (j.error || 'unknown'));
                          if (j.reanalysis_result && j.reanalysis_result.answer) {
                            setMessages((m) => [...m, { from: 'bot', text: j.reanalysis_result.answer }]);
                            setLastResponseMeta((prev) => ({ ...(prev || {}), originalAnalysis: { answer: j.reanalysis_result.answer } }));
                          }
                        } catch (e) { console.error(e); alert('Failed to reject'); }
                      }}>Reject & Re-answer</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* HIL status display for chat-based analysis */}
          {hilPending && hilData && (
            <div className="mt-4">
              <HILStatusChecker
                hilId={hilData.hil_id}
                analysisId={hilData.analysis_id}
                onComplete={(approvedAnalysis) => {
                  setMessages((m) => [...m, { from: 'bot', text: approvedAnalysis.answer || 'No answer' }]);
                  setHilPending(false);
                  setHilData(null);
                }}
                onError={(err) => {
                  setMessages((m) => [...m, { from: 'bot', text: 'Expert review failed: ' + err }]);
                  setHilPending(false);
                  setHilData(null);
                }}
              />
            </div>
          )}

        </div>
      </div>

      <form onSubmit={send} className="flex gap-3 flex-col">
        <div className="flex items-center gap-4 mb-2">
          <div className="text-sm text-zinc-400">India-only analysis is enabled by default.</div>

          {/* Language Selector */}
          <LanguageSelector
            value={selectedLanguage}
            onChange={setSelectedLanguage}
          />

          <label className="flex items-center gap-2 text-sm ml-auto">
            <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} className="h-4 w-4" />
            <span className="text-zinc-400">Debug (show matched laws & clauses)</span>
          </label>
        </div>

        <div className="flex gap-3">
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
        </div>

        {/* Contribute to Training Button */}
        {messages.length > 2 && (
          <button
            type="button"
            onClick={async () => {
              if (!confirm('Would you like to contribute this conversation to help improve the AI model? Your chat will be reviewed by admins for training purposes.')) {
                return;
              }

              try {
                const res = await fetch('/api/contribute-chat', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    messages: messages.map(m => ({
                      role: m.from === 'user' ? 'user' : 'assistant',
                      content: m.text
                    })),
                    metadata: {
                      messageCount: messages.length,
                      timestamp: new Date().toISOString()
                    }
                  })
                });

                const data = await res.json();

                if (data.success) {
                  alert('✅ Thank you for contributing! Your chat will help improve the AI model.');
                } else {
                  alert('Failed to contribute: ' + (data.error || 'Unknown error'));
                }
              } catch (err) {
                alert('Error: ' + err.message);
              }
            }}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span>🎓</span>
            <span>Contribute this chat to improve AI</span>
          </button>
        )}
      </form>
    </div>
  );
}
