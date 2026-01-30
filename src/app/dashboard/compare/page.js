"use client";
import { useState } from "react";

export default function ComparePage() {
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      if (fileA) fd.append("offerA", fileA);
      if (fileB) fd.append("offerB", fileB);

      const res = await fetch("/api/compare", { method: "POST", body: fd });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Server returned ${res.status}`);
      }
      const json = await res.json();
      setResult(json);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Compare Offer Letters ⚖️</h1>
      <p className="text-zinc-400 mb-6">Upload two offer letters (PDF) and get a side-by-side pros/cons and a recommendation. Uses Qwen locally with Gemini fallback.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-300 mb-1">Offer A (PDF)</label>
          <input type="file" accept="application/pdf" onChange={(e) => setFileA(e.target.files?.[0] ?? null)} />
        </div>

        <div>
          <label className="block text-sm text-zinc-300 mb-1">Offer B (PDF)</label>
          <input type="file" accept="application/pdf" onChange={(e) => setFileB(e.target.files?.[0] ?? null)} />
        </div>

        <div>
          <button type="submit" disabled={loading} className="bg-blue-600 px-4 py-2 rounded">
            {loading ? "Comparing..." : "Compare Offers"}
          </button>
        </div>
      </form>

      {error && (<div className="mt-6 text-red-400">{error}</div>)}

      {result && (
        <div className="mt-6 space-y-6">
          <div className="bg-zinc-850 p-4 rounded">
            <h3 className="font-semibold">Recommendation</h3>
            <p className="text-zinc-300">{result.recommendation?.which} — {result.recommendation?.reason}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-850 p-4 rounded">
              <h3 className="font-semibold">Offer A</h3>
              <p className="text-zinc-300 mt-2"><strong>Pros</strong></p>
              <ul className="list-disc ml-6 mt-2 text-zinc-300">
                {(result.offerA?.pros || []).map((p, i) => <li key={i}>{p}</li>)}
              </ul>
              <p className="text-zinc-300 mt-4"><strong>Cons</strong></p>
              <ul className="list-disc ml-6 mt-2 text-zinc-300">
                {(result.offerA?.cons || []).map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>

            <div className="bg-zinc-850 p-4 rounded">
              <h3 className="font-semibold">Offer B</h3>
              <p className="text-zinc-300 mt-2"><strong>Pros</strong></p>
              <ul className="list-disc ml-6 mt-2 text-zinc-300">
                {(result.offerB?.pros || []).map((p, i) => <li key={i}>{p}</li>)}
              </ul>
              <p className="text-zinc-300 mt-4"><strong>Cons</strong></p>
              <ul className="list-disc ml-6 mt-2 text-zinc-300">
                {(result.offerB?.cons || []).map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          </div>

          {result.analysis && (
            <div className="bg-zinc-850 p-4 rounded">
              <h3 className="font-semibold">Raw Model Output</h3>
              <pre className="whitespace-pre-wrap text-sm text-zinc-300 mt-2">{JSON.stringify(result.analysis, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
