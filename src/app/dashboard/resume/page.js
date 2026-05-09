"use client";
import { useState } from "react";

export default function ResumeScreeningPage() {
  const [jd, setJd] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [topN, setTopN] = useState(1);
  const [useQwen, setUseQwen] = useState(true);
  const [checkFormatting, setCheckFormatting] = useState(true);
  const [extractForm, setExtractForm] = useState(true);
  const [shortlist, setShortlist] = useState(null);

  const [interviewerFile, setInterviewerFile] = useState(null);
  const [matching, setMatching] = useState(false);
  const [matches, setMatches] = useState(null);
  const [showMatchModal, setShowMatchModal] = useState(false);

  async function handleFindInterviewers() {
    if (!shortlist || !interviewerFile) return;
    setMatching(true);
    try {
      const fd = new FormData();
      // Send top candidates from shortlist if available, otherwise all results
      const candidates = shortlist?.top ? shortlist.top : results.slice(0, 5);
      // We need more details than just shortlist summary, let's try to map back to full results if possible or just use what we have.
      // The shortlist has name and highlights/reason. That might be enough.
      // Let's actually find the full result object for better context if possible.
      const fullCandidates = candidates.map(c => {
        const full = results.find(r => r.name === c.name || (r.name.includes(c.name)));
        return full || c;
      });

      fd.append('candidates', JSON.stringify(fullCandidates));
      fd.append('file', interviewerFile);

      const res = await fetch('/api/hr/match-interviewers', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Matching failed: ${res.statusText}`);
      const json = await res.json();
      setMatches(json.matches);
    } catch (err) {
      alert(err.message);
    } finally {
      setMatching(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const fd = new FormData();
      fd.append('jd', jd);
      fd.append('topN', String(topN || 1));
      fd.append('useQwen', useQwen ? 'true' : 'false');
      fd.append('checkFormatting', checkFormatting ? 'true' : 'false');
      fd.append('extractForm', extractForm ? 'true' : 'false');
      for (let i = 0; i < files.length; i++) fd.append('resumes', files[i]);

      const res = await fetch('/api/hr/screen-resumes', { method: 'POST', body: fd });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Server returned ${res.status}`);
      }
      const json = await res.json();
      setResults(json.results || []);
      setShortlist(json.shortlist || null);
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
          <label className="block text-sm text-zinc-300 mb-1">Resumes (PDF / DOCX) — select multiple</label>
          <input type="file" accept=".pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-300 mb-1">Top N to shortlist</label>
            <input type="number" min={1} value={topN} onChange={(e) => setTopN(Number(e.target.value))} className="w-full bg-zinc-800 p-2 rounded" />
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-1">Use Qwen for ranking</label>
            <div className="mt-1">
              <label className="inline-flex items-center">
                <input type="checkbox" checked={useQwen} onChange={(e) => setUseQwen(e.target.checked)} className="mr-2" />
                <span className="text-sm text-zinc-300">Enable Qwen ranking</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-1">Check formatting</label>
            <div className="mt-1">
              <label className="inline-flex items-center">
                <input type="checkbox" checked={checkFormatting} onChange={(e) => setCheckFormatting(e.target.checked)} className="mr-2" />
                <span className="text-sm text-zinc-300">Flag missing sections/format issues</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-1">Extract form fields</label>
            <div className="mt-1">
              <label className="inline-flex items-center">
                <input type="checkbox" checked={extractForm} onChange={(e) => setExtractForm(e.target.checked)} className="mr-2" />
                <span className="text-sm text-zinc-300">Extract email/phone if present</span>
              </label>
            </div>
          </div>
        </div>

        <div>
          <button disabled={loading} className="bg-blue-600 px-4 py-2 rounded">{loading ? 'Screening...' : 'Start Screening'}</button>
        </div>
      </form>

      {error && <div className="mt-4 text-red-400">{error}</div>}

      {results && (
        <div className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Results</h2>
            {shortlist && (
              <button
                onClick={() => setShowMatchModal(true)}
                className="bg-green-600 px-4 py-2 rounded text-sm hover:bg-green-700 transition"
              >
                Allot Interviewer 👥
              </button>
            )}
          </div>

          {showMatchModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-zinc-900 p-6 rounded-lg max-w-lg w-full border border-zinc-700">
                <h3 className="text-xl font-bold mb-4">Allot Interviewer</h3>
                <p className="text-sm text-zinc-400 mb-4">Upload a CSV file with columns: Name, Stack, Current Project, Department, Designation.</p>

                <input
                  type="file"
                  accept=".csv"
                  className="mb-4 block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700"
                  onChange={(e) => setInterviewerFile(e.target.files[0])}
                />

                {matches && (
                  <div className="mb-4 max-h-60 overflow-y-auto bg-zinc-800 p-3 rounded">
                    {matches.map((m, i) => (
                      <div key={i} className="mb-3 border-b border-zinc-700 pb-2 last:border-0">
                        <div className="font-semibold text-white">{m.candidateName}</div>
                        <div className="text-sm text-green-400">Matched: {m.match.interviewer_name}</div>
                        <div className="text-xs text-zinc-400">{m.match.reason}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button onClick={() => { setShowMatchModal(false); setMatches(null); }} className="px-4 py-2 text-zinc-300 hover:text-white">Close</button>
                  <button
                    disabled={!interviewerFile || matching}
                    onClick={handleFindInterviewers}
                    className="bg-blue-600 px-4 py-2 rounded text-white disabled:opacity-50"
                  >
                    {matching ? 'Matching...' : 'Find Matches'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {shortlist && (
            <div className="bg-zinc-900 p-4 rounded mb-4">
              <h3 className="font-semibold">Shortlisted Candidates</h3>
              <div className="text-sm text-zinc-400">Top selection by Qwen:</div>
              <ol className="list-decimal ml-6 mt-2">
                {shortlist.top.map((t, idx) => (
                  <li key={idx} className="mt-1">
                    <div className="font-medium">{t.name} (index: {t.idx})</div>
                    <div className="text-sm text-zinc-300">Reason: {t.rank_reason || t.reason || '—'}</div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {results.map((r, i) => (
            <div key={i} className={`bg-zinc-900 p-4 rounded ${shortlist && shortlist.top && shortlist.top.find(t => t.idx === i) ? 'ring-2 ring-blue-600' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{r.name || `Resume ${i + 1}`}</div>
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
                {r.fields && (
                  <div className="mt-2 text-sm text-zinc-400"><strong>Extracted Fields:</strong> Email: {r.fields.email || 'N/A'} — Phone: {r.fields.phone || 'N/A'}</div>
                )}
                {r.formatting && (
                  <div className="mt-2 text-sm text-zinc-400"><strong>Formatting:</strong> Sections: {r.formatting.sections}, Has Experience: {r.formatting.has_experience_section ? 'Yes' : 'No'}, Has Education: {r.formatting.has_education_section ? 'Yes' : 'No'}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
