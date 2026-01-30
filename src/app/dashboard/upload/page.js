"use client";
import { useState } from "react";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    setAnalysis(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      setUploadResult(data);
      
      // Auto-analyze after upload
      if (data.status === "ok") {
        await analyzeContract(data.filename);
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
      const form = new FormData();
      form.append("filename", filename);
      const res = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      setAnalysis({ error: String(err) });
    } finally {
      setAnalyzing(false);
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
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded-lg"
          />
        </div>
        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded-lg font-semibold transition-colors"
        >
          {uploading ? "Uploading..." : "Upload & Analyze"}
        </button>
      </form>

      {uploadResult && (
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-3">Upload Result</h3>
          {uploadResult.error ? (
            <div className="text-red-400">{uploadResult.error}</div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Status:</span>
                <span className="text-green-400">{uploadResult.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Filename:</span>
                <span className="text-white">{uploadResult.filename}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Chunks Processed:</span>
                <span className="text-white">{uploadResult.chunks}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {analyzing && (
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl text-center">
          <div className="text-blue-400 mb-2">Analyzing contract...</div>
          <div className="text-sm text-zinc-400">This may take a few moments</div>
        </div>
      )}

      {analysis && !analyzing && (
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl space-y-6">
          <h3 className="text-2xl font-bold">Contract Analysis</h3>

          {analysis.error || analysis.raw ? (
            <div className="bg-zinc-800 p-4 rounded text-sm text-zinc-300 whitespace-pre-wrap">
              {analysis.error || analysis.raw}
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
                      className={`h-full ${
                        analysis.final_score > 70
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
                            <span className="text-xs bg-blue-600 px-2 py-1 rounded">
                              {clause.classification || "Unknown"}
                            </span>
                            <span
                              className={`ml-2 text-xs px-2 py-1 rounded ${
                                clause.risk_level === "High"
                                  ? "bg-red-600"
                                  : clause.risk_level === "Medium"
                                  ? "bg-yellow-600"
                                  : "bg-green-600"
                              }`}
                            >
                              {clause.risk_level || "Unknown"} Risk
                            </span>
                          </div>
                          <div className="text-xl font-bold">{clause.risk_score || 0}/100</div>
                        </div>
                        <p className="text-sm text-zinc-300 mb-3">{clause.text}</p>
                        <div className="text-xs text-zinc-400 border-t border-zinc-700 pt-3">
                          <strong>Analysis:</strong> {clause.explanation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
