"use client";
import { useState } from "react";
import HILStatusChecker from "@/components/HILStatusChecker";
import ContractActions from "@/components/ContractActions";
import LanguageSelector from "@/components/LanguageSelector";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [useHIL, setUseHIL] = useState(false);
  const [createFeedback, setCreateFeedback] = useState(false);

  // HIL status tracking
  const [hilPending, setHilPending] = useState(false);
  const [hilData, setHilData] = useState(null);

  // Ingest controls
  const [ingesting, setIngesting] = useState(false);
  const [ingestFilename, setIngestFilename] = useState('');
  const [ingestResult, setIngestResult] = useState(null);
  const [showExpertPrompt, setShowExpertPrompt] = useState(false);
  const [pendingFeedbackId, setPendingFeedbackId] = useState(null);

  // Voice features (TTS)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // New features: Negotiation, Missing Clauses, Contract Chat
  const [showNegotiation, setShowNegotiation] = useState(false);
  const [negotiationData, setNegotiationData] = useState(null);
  const [loadingNegotiation, setLoadingNegotiation] = useState(false);

  const [showMissingClauses, setShowMissingClauses] = useState(false);
  const [missingClausesData, setMissingClausesData] = useState(null);
  const [loadingMissingClauses, setLoadingMissingClauses] = useState(false);

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [contractText, setContractText] = useState('');

  // Language selection
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    setAnalysis(null);
    setHilPending(false);
    setHilData(null);

    const form = new FormData();
    form.append("file", file);

    try {
      if (useHIL) form.append('useHIL', 'true');
      if (createFeedback) form.append('createFeedback', 'true');
      form.append('language', selectedLanguage); // Add selected language

      const res = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      setUploadResult(data);

      // Check if HIL (Human-in-the-Loop) is mandatory
      if (data.hil_mandatory) {
        setHilPending(true);
        setHilData({
          hil_id: data.hil_id,
          analysis_id: data.analysis_id,
          message: data.message
        });
      } else {
        // Legacy behavior: If server already returned analysis, use it; otherwise trigger analysis
        if (data.analysis) {
          setAnalysis(data.analysis);
        } else if (data.success && data.filename) {
          await analyzeContract(data.filename);
        }

        // If server says expert action is required (uploader is an expert), prompt user
        if (data.expert_action_required) {
          setPendingFeedbackId(data.pending_feedback_id || data.analysis?.analysisId || null);
          setShowExpertPrompt(true);
        }
      }
    } catch (err) {
      setUploadResult({ error: String(err) });
    } finally {
      setUploading(false);
    }
  }

  async function analyzeContract(filename) {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, language: selectedLanguage }),
      });
      const data = await res.json();
      if (data.analysis) setAnalysis(data.analysis);
      else setAnalysis(data);

      // Save to localStorage for redesign feature
      try {
        const stored = localStorage.getItem('analyzedContracts') || '[]';
        const contracts = JSON.parse(stored);
        const newContract = {
          name: filename,
          risk: data.analysis?.final_score || 0,
          analyzedAt: new Date().toISOString()
        };

        // Add if not already exists
        if (!contracts.find(c => c.name === filename)) {
          contracts.push(newContract);
          localStorage.setItem('analyzedContracts', JSON.stringify(contracts));
        }
      } catch (e) {
        console.warn('Failed to save to localStorage:', e);
      }

      // If analysis created a pending feedback for admin, prompt expert if current user is admin
      if (data.feedback_id) {
        setPendingFeedbackId(data.feedback_id);
        setShowExpertPrompt(true);
      }
    } catch (err) {
      setAnalysis({ error: String(err) });
    } finally {
      setAnalyzing(false);
    }
  }

  // Generate audio from analysis summary
  async function handleListenToAnalysis() {
    if (!analysis || !analysis.summary) {
      alert('No analysis summary available to read');
      return;
    }

    setIsGeneratingAudio(true);
    try {
      // Create text to read aloud
      const textToRead = `Contract Analysis Summary. Overall Risk Score: ${analysis.final_score || 'unknown'} out of 100. ${analysis.summary}`;

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToRead }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate audio');
      }

      // Create audio URL from blob
      const audioBlob = await res.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      // Auto-play the audio
      const audio = new Audio(url);
      audio.play();
      setIsPlaying(true);

      audio.onended = () => setIsPlaying(false);
    } catch (err) {
      console.error('TTS error:', err);
      alert('Failed to generate audio: ' + (err.message || 'Unknown error'));
    } finally {
      setIsGeneratingAudio(false);
    }
  }

  // Ingest handlers
  async function ingestAll() {
    setIngesting(true);
    setIngestResult(null);
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setIngestResult(data);
      // If processed, refresh status in uploadResult
      if (data.processedChunks !== undefined) {
        setUploadResult((prev) => ({ ...(prev || {}), processed: data.processedChunks }));
      }
    } catch (err) {
      setIngestResult({ error: String(err) });
    } finally {
      setIngesting(false);
    }
  }

  async function ingestOne() {
    if (!ingestFilename) return setIngestResult({ error: 'Filename required' });
    setIngesting(true);
    setIngestResult(null);
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: ingestFilename }),
      });
      const data = await res.json();
      setIngestResult(data);
      // Optionally auto-analyze the file
      if (data.success && ingestFilename) {
        await analyzeContract(ingestFilename);
      }
    } catch (err) {
      setIngestResult({ error: String(err) });
    } finally {
      setIngesting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Upload Contract</h2>
        <p className="text-zinc-400">Upload a PDF contract for AI-powered analysis</p>
      </div>

      <form onSubmit={handleUpload} className="bg-zinc-900 border border-zinc-800 p-8 rounded-xl space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Select PDF Contract</label>
          <input
            type="file"
            accept=".pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded-lg"
          />

          {/* Language Selector */}
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2 text-zinc-300">
              Analysis Language
            </label>
            <LanguageSelector
              value={selectedLanguage}
              onChange={setSelectedLanguage}
            />
            <p className="text-xs text-zinc-500 mt-1">
              Select the language for contract analysis and results
            </p>
          </div>

          <div className="mt-3 flex gap-4 items-center">
            <label className="inline-flex items-center">
              <input type="checkbox" checked={useHIL} onChange={(e) => setUseHIL(e.target.checked)} className="mr-2" />
              <span className="text-sm text-zinc-300">Submit for Expert Review (HIL)</span>
            </label>

            <label className="inline-flex items-center">
              <input type="checkbox" checked={createFeedback} onChange={(e) => setCreateFeedback(e.target.checked)} className="mr-2" />
              <span className="text-sm text-zinc-300">Create a feedback record for experts (non-blocking)</span>
            </label>
          </div>
        </div>
        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded-lg font-semibold transition-colors"
        >
          {uploading ? "Uploading..." : "Upload & Analyze"}
        </button>
      </form>

      {/* HIL Status Display */}
      {hilPending && hilData && (
        <HILStatusChecker
          hilId={hilData.hil_id}
          analysisId={hilData.analysis_id}
          onComplete={(approvedAnalysis) => {
            setAnalysis(approvedAnalysis);
            setHilPending(false);
            setHilData(null);
          }}
          onError={(errorMsg) => {
            setUploadResult({ error: errorMsg });
            setHilPending(false);
            setHilData(null);
          }}
        />
      )}

      {/* Ingest controls */}
      <div className="mt-4 bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
        <h3 className="text-lg font-semibold mb-3">Ingest PDFs</h3>
        <div className="flex gap-2 mb-3">
          <button
            onClick={ingestAll}
            disabled={ingesting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            {ingesting ? 'Ingesting...' : 'Ingest All PDFs'}
          </button>
          <input
            type="text"
            placeholder="Filename (e.g., contract.pdf)"
            value={ingestFilename}
            onChange={(e) => setIngestFilename(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white px-3 py-2 rounded flex-1"
          />
          <button
            onClick={ingestOne}
            disabled={ingesting || !ingestFilename}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
          >
            {ingesting ? 'Ingesting...' : 'Ingest File'}
          </button>
        </div>

        {ingestResult && (
          <div className="text-sm text-zinc-300">
            {ingestResult.error ? (
              <div className="text-red-400">{ingestResult.error}</div>
            ) : (
              <div>
                <div>Success: {ingestResult.success ? 'Yes' : 'No'}</div>
                <div>Processed chunks: {ingestResult.processedChunks ?? ingestResult.processed ?? 0}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {uploadResult && (
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-3">Upload Result</h3>
          {uploadResult.error ? (
            <div className="text-red-400">{uploadResult.error}</div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Success:</span>
                <span className="text-green-400">{uploadResult.success ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Filename:</span>
                <span className="text-white">{uploadResult.filename}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Chunks Processed:</span>
                <span className="text-white">{uploadResult.chunks || uploadResult.processed || 0}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {analyzing && (
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl mt-4">
          <p className="text-zinc-400">Analyzing contract...</p>
        </div>
      )}

      {/* Analysis Result */}
      {analysis && (
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Analysis</h3>
            {analysis.summary && (
              <button
                onClick={handleListenToAnalysis}
                disabled={isGeneratingAudio}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 text-white rounded-lg transition-colors"
              >
                {isGeneratingAudio ? (
                  <>
                    <span className="animate-spin">⚙️</span>
                    Generating Audio...
                  </>
                ) : isPlaying ? (
                  <>
                    🔊 Playing...
                  </>
                ) : (
                  <>
                    🎧 Listen to Summary
                  </>
                )}
              </button>
            )}
          </div>

          {/* Audio Player */}
          {audioUrl && (
            <div className="mb-4 bg-zinc-800 p-3 rounded-lg">
              <audio controls src={audioUrl} className="w-full">
                Your browser does not support the audio element.
              </audio>
            </div>
          )}

          <pre className="text-xs text-zinc-300 whitespace-pre-wrap max-h-96 overflow-auto p-2 bg-zinc-800 rounded">{JSON.stringify(analysis, null, 2)}</pre>
        </div>
      )}

      {/* Scraped Clauses from Firecrawl */}
      {uploadResult?.scraped_clauses && uploadResult.scraped_clauses.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl mt-4">
          <h3 className="text-lg font-semibold mb-3">Related Clauses (Human-in-the-Loop suggestions)</h3>
          <p className="text-zinc-400 mb-3">These related clauses were fetched from public sources using Firecrawl and are provided with lower confidence. They are suggestions and should be verified by an expert.</p>
          <ul className="space-y-3 text-sm">
            {uploadResult.scraped_clauses.map((c, idx) => (
              <li key={idx} className="border border-zinc-800 rounded p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-4">
                    <div className="font-semibold">{c.title || 'External clause'}</div>
                    <div className="text-zinc-400 text-xs">Source: <a href={c.source} className="text-blue-400 underline" target="_blank" rel="noreferrer">{c.source}</a></div>
                    <div className="mt-2 whitespace-pre-wrap text-zinc-200">{c.text}</div>
                  </div>
                  <div className="text-zinc-300 text-sm text-right">
                    <div>Confidence: {(c.confidence * 100).toFixed(0)}%</div>
                    <div className="mt-2">Type: {c.type}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis && !analyzing && (
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl space-y-6">
          <h3 className="text-2xl font-bold">Contract Analysis</h3>

          {analysis.error ? (
            <div className="bg-zinc-800 p-4 rounded text-sm text-zinc-300">
              <div className="mb-2">{analysis.error}</div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    // Trigger a re-analysis silently (no raw shown to users)
                    setAnalyzing(true);
                    try {
                      if (uploadResult?.filename) await analyzeContract(uploadResult.filename);
                    } catch (err) {
                      setAnalysis({ error: String(err) });
                    } finally { setAnalyzing(false); }
                  }}
                  className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-black rounded"
                >Request Reanalysis</button>
              </div>
            </div>
          ) : (
            <>
              {/* Risk Score */}
              {analysis.final_score !== undefined && (
                <div className="bg-zinc-800 p-6 rounded-lg">
                  <div className="text-sm text-zinc-400 mb-2">Overall Risk Score</div>
                  <div className="flex items-end gap-3">
                    <div className="text-5xl font-bold">{analysis.final_score}</div>
                    <div className="text-zinc-400 mb-2">/100</div>
                  </div>
                  <div className="mt-4 h-3 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${analysis.final_score > 70
                        ? "bg-red-500"
                        : analysis.final_score > 40
                          ? "bg-yellow-500"
                          : "bg-green-500"
                        }`}
                      style={{ width: `${analysis.final_score}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Summary */}
              {analysis.summary && (
                <div className="bg-zinc-800 p-6 rounded-lg">
                  <h4 className="font-semibold mb-2">Summary</h4>
                  <p className="text-zinc-300">{analysis.summary}</p>
                </div>
              )}

              {/* Clauses */}
              {analysis.clauses && analysis.clauses.length > 0 && (
                <div>
                  <h4 className="text-xl font-semibold mb-4">Detected Clauses</h4>
                  <div className="space-y-4">
                    {analysis.clauses.map((clause, idx) => (
                      <div key={idx} className="bg-zinc-800 border border-zinc-700 p-5 rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            {clause.category && (
                              <span className="text-xs bg-blue-600 px-2 py-1 rounded">
                                {clause.category}
                              </span>
                            )}
                            {clause.risk_level && (
                              <span
                                className={`ml-2 text-xs px-2 py-1 rounded ${clause.risk_level === "critical" || clause.risk_level === "Critical"
                                  ? "bg-red-600"
                                  : clause.risk_level === "high" || clause.risk_level === "High"
                                    ? "bg-red-600"
                                    : clause.risk_level === "medium" || clause.risk_level === "Medium"
                                      ? "bg-yellow-600"
                                      : "bg-green-600"
                                  }`}
                              >
                                {String(clause.risk_level).toUpperCase()} Risk
                              </span>
                            )}
                          </div>
                          <div className="text-xl font-bold">{clause.risk_score ?? 0}/100</div>
                        </div>
                        <p className="text-sm text-zinc-300 mb-3">{clause.clause_text || clause.text || ''}</p>
                        {(clause.description && clause.description !== clause.clause_text && clause.description !== clause.text) && (
                          <div className="text-xs text-zinc-400 border-t border-zinc-700 pt-3">
                            <strong>Analysis:</strong> {clause.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}


            </>
          )}
        </div>
      )}

      {/* Contract Actions: Negotiation, Missing Clauses, Chat */}
      <ContractActions
        uploadResult={uploadResult}
        analysis={analysis}
        contractText={uploadResult?.filename || ''}
      />

      {/* Expert prompt modal */}
      {showExpertPrompt && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded max-w-md w-full">
            <h3 className="text-xl font-semibold mb-2">Expert action required</h3>
            <p className="text-zinc-400 mb-4">You are an Expert. The recently uploaded analysis is awaiting human review. Would you like to review it now?</p>
            <div className="flex gap-3 justify-end">
              <button className="px-3 py-2 bg-zinc-700 rounded" onClick={() => { setShowExpertPrompt(false); setPendingFeedbackId(null); }}>Later</button>
              <button className="px-3 py-2 bg-blue-600 rounded" onClick={() => {
                setShowExpertPrompt(false);
                // Navigate to expert review page and focus the pending feedback
                const id = pendingFeedbackId;
                if (id) window.location.href = `/dashboard/expert-review?feedbackId=${encodeURIComponent(id)}`;
                else window.location.href = '/dashboard/expert-review';
              }}>Review now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
