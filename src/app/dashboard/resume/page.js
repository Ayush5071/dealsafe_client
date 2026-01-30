"use client";
import { useState } from "react";

export default function ResumeScreeningPage() {
  const [jd, setJd] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const fd = new FormData();
      fd.append('jd', jd);
      for (let i = 0; i < files.length; i++) fd.append('resumes', files[i]);

      const res = await fetch('/api/hr/screen-resumes', { method: 'POST', body: fd });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Server returned ${res.status}`);
      }
      const json = await res.json();
      setResults(json.results || []);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Resume Screening 🧾</h1>
      <p className="text-zinc-400 mb-6">Upload a job description and multiple resumes to screen candidates. This feature is available to HR professionals and Recruiters only.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-300 mb-1">Job Description (paste text)</label>
          <textarea className="w-full bg-zinc-800 text-white p-3 rounded" rows={6} value={jd} onChange={(e) => setJd(e.target.value)} required />
        </div>

        <div>
          <label className="block text-sm text-zinc-300 mb-1">Resumes (PDF) — select multiple</label>
          <input type="file" accept="application/pdf" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
        </div>

        <div>
          <button disabled={loading} className="bg-blue-600 px-4 py-2 rounded">{loading ? 'Screening...' : 'Start Screening'}</button>
        </div>
      </form>

      {error && <div className="mt-4 text-red-400">{error}</div>}

      {results && (
        <div className="mt-6 space-y-4">
          <h2 className="text-xl font-semibold">Results</h2>
          {results.map((r, i) => (
            <div key={i} className="bg-zinc-900 p-4 rounded">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{r.name || `Resume ${i+1}`}</div>
                  <div className="text-zinc-400 text-sm">Score: {r.score || 'N/A'} — Match: {r.match_percentage || 'N/A'}%</div>
                </div>
                <div className="text-sm text-zinc-300">{r.suggestion || ''}</div>
              </div>

              <div className="mt-3 text-zinc-300">
                <strong>Pros:</strong>
                <ul className="list-disc ml-6 mt-1">
                  {(r.pros || []).map((p, idx) => <li key={idx}>{p}</li>)}
                </ul>
                <strong className="mt-2 block">Cons:</strong>
                <ul className="list-disc ml-6 mt-1">
                  {(r.cons || []).map((c, idx) => <li key={idx}>{c}</li>)}
                </ul>
                <div className="mt-2 text-sm text-zinc-400"><strong>Highlights:</strong> {(r.highlights || []).join('; ')}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
