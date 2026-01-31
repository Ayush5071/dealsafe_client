"use client";
import { useEffect, useState } from 'react';

export default function HILDashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState('');
  const [documentText, setDocumentText] = useState('');
  const [userRole, setUserRole] = useState('');
  const [applyToVectorStore, setApplyToVectorStore] = useState(true);
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [reanalysisPreview, setReanalysisPreview] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [trainingExamples, setTrainingExamples] = useState([]);
  const [loadingExamples, setLoadingExamples] = useState(false);
  const [lastTrainingMetrics, setLastTrainingMetrics] = useState(null);

  useEffect(() => {
    fetchPending();
  }, []);

  // When reviewer selects an item, populate editable inputs
  useEffect(() => {
    if (!selected) return;
    const existingText = selected.payload?.document_text || selected.originalAnalysis || selected.analysis || (selected.originalAnalysis ? JSON.stringify(selected.originalAnalysis, null, 2) : '');
    setDocumentText(typeof existingText === 'string' ? existingText : JSON.stringify(existingText, null, 2));
    setUserRole(selected.payload?.user_role || selected.payload?.userRole || '');
    setFileName(selected.documentName || selected.document_name || selected.analysis_id || '');
    setComment('');
    setApplyToVectorStore(true);
  }, [selected]);

  async function fetchPending() {
    setLoading(true);
    try {
      const res = await fetch('/api/hil-review');
      const j = await res.json();
      if (res.ok) {
        setItems(j.pending_reviews || []);
      } else {
        alert('Failed to load pending reviews: ' + (j.error || 'unknown'));
      }
    } catch (e) {
      console.error('Fetch HIL failed', e);
      alert('Failed to load HIL items');
    } finally {
      setLoading(false);
    }
  }

  async function fetchTrainingExamples(text, limit = 5) {
    if (!text || text.trim().length === 0) return setTrainingExamples([]);
    setLoadingExamples(true);
    try {
      const res = await fetch('/api/hil-training/examples', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, limit }) });
      const j = await res.json();
      if (res.ok) {
        setTrainingExamples(j.examples || []);
      } else {
        alert('Failed to load training examples: ' + (j.error || 'unknown'));
      }
    } catch (e) {
      console.error('Fetch training examples failed', e);
      alert('Failed to load training examples');
    } finally {
      setLoadingExamples(false);
    }
  }

  async function doAction(action) {
    if (!selected) return alert('Select an item first');
    if (!confirm(`Are you sure you want to ${action} this analysis?`)) return;
    setSubmitting(true);
    setReanalysisPreview(null);
    setLastTrainingMetrics(null);
    try {
      const hilId = selected._id || selected.hil_id || selected.hilId;
      const payload = {
        hil_id: hilId,
        action,
        feedback: {
          comments: comment || '',
          document_text: documentText,
          user_role: userRole,
          apply_to_vector_store: applyToVectorStore,
          request_reanalysis: action === 'request_reanalysis' || action === 'reject',
          // Attach client-side analysis preview if available (so server can persist or use it)
          analysis_preview: analysisResult || reanalysisPreview || null
        }
      };
      const res = await fetch('/api/hil-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (res.ok) {
        if (j.reanalysis_result) {
          setReanalysisPreview(j.reanalysis_result);
          alert(`${action} successful — reanalysis returned (preview available).`);
        } else if (j.status === 'approved' || j.approved) {
          alert(`${action} successful — analysis approved.`);
          if (j.hil_vectorized || j.last_training_metrics) {
            setLastTrainingMetrics(j.last_training_metrics || null);
            // reload examples if possible
            if (selected) fetchTrainingExamples(selected.payload?.document_text || (selected.analysis || selected.originalAnalysis ? JSON.stringify(selected.analysis || selected.originalAnalysis) : ''));
          }
        } else {
          alert(`${action} successful`);
        }
        setSelected(null);
        setComment('');
        setDocumentText('');
        setUserRole('');
        setFileName('');
        fetchPending();
      } else {
        alert('Action failed: ' + (j.error || 'unknown'));
      }
    } catch (e) {
      console.error('HIL action error', e);
      alert('Action failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">HIL — Admin & Expert Reviews</h1>
        <p className="text-zinc-400">This page lists pending Human-in-the-Loop items for review (admins and experts only).</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded">
            <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Pending Analyses</h3>
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-zinc-700 rounded" onClick={()=>fetchPending()}>Refresh</button>
              <button className="px-3 py-1 bg-blue-600 rounded" onClick={async ()=>{
                try {
                  const res = await fetch('/api/admin/hil-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentName: 'test_doc_for_ui' }) });
                  const j = await res.json();
                  if (!res.ok) return alert('Failed: ' + (j.error || 'unknown'));
                  alert('Test HIL item created');
                  fetchPending();
                } catch (e) { console.error(e); alert('Failed to create test item'); }
              }}>Create Test Item</button>

              {/* Bulk create */}
              <div className="flex items-center gap-2">
                <input type="text" placeholder="Company (e.g., Acme Corp)" id="bulkCompany" defaultValue="Acme Corp" className="bg-zinc-800 p-2 rounded text-sm" />
                <input type="number" id="bulkCount" defaultValue={40} min={1} max={500} className="w-20 bg-zinc-800 p-2 rounded text-sm" />
                <button className="px-3 py-1 bg-purple-600 rounded" onClick={async ()=>{
                  try {
                    const company = document.getElementById('bulkCompany')?.value || 'Acme Corp';
                    const count = Number(document.getElementById('bulkCount')?.value || 40);
                    if (!confirm(`Create ${count} test reviews for ${company}?`)) return;
                    const res = await fetch('/api/admin/hil-bulk-create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company, count }) });
                    const j = await res.json();
                    if (!res.ok) return alert('Failed: ' + (j.error || 'unknown'));
                    alert(`Created ${j.created_count} items for ${j.company}`);
                    fetchPending();
                  } catch (e) { console.error(e); alert('Bulk create failed'); }
                }}>Create Bulk</button>
              </div>
            </div>
          </div>
            {loading ? (
              <div className="text-zinc-400">Loading...</div>
            ) : items.length === 0 ? (
              <div className="text-zinc-400">No pending items</div>
            ) : (
              <div className="space-y-3">
                {items.map((it) => (
                  <div key={it._id} className={`p-3 rounded border ${selected && selected._id === it._id ? 'border-blue-500 bg-zinc-800' : 'border-zinc-700'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-sm">{it.documentName || it.analysisId}</div>
                        <div className="text-xs text-zinc-400">Submitted by: {it.userEmail}</div>
                        <div className="text-xs text-zinc-400">Status: {it.status}</div>
                      </div>
                      <div>
                        <button className="px-3 py-1 bg-blue-600 rounded" onClick={() => setSelected(it)}>Open</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded">
            <h3 className="font-semibold mb-3">Review</h3>
            {!selected ? (
              <div className="text-zinc-400">Select an item to view details</div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-zinc-300">Document: <strong>{selected.documentName}</strong></div>
                <div className="text-xs text-zinc-400">Submitted by: {selected.userEmail} — Created: {new Date(selected.createdAt).toLocaleString()}</div>

                <div className="mt-3">
                  <h4 className="font-medium">Editable Document / Inputs</h4>

                  <div className="text-xs text-zinc-400 mb-2">Document name: <strong className="text-zinc-200">{fileName}</strong></div>

                  <div className="mb-2">
                    <label className="text-xs text-zinc-400">Upload / Replace File (optional)</label>
                    <input type="file" accept=".pdf,.txt,.md,.doc,.docx" onChange={(e)=>{
                      const f = e.target.files?.[0];
                      if (!f) return; setFileName(f.name); setSelectedFile(f);
                      reader.readAsText(f);
                    }} className="w-full mt-1" />
                  </div>

                  <div className="mb-2">
                    <label className="text-xs text-zinc-400">Document Text (editable)</label>
                    <textarea value={documentText} onChange={(e)=>setDocumentText(e.target.value)} rows={6} className="w-full bg-zinc-800 p-2 rounded mt-1 text-sm" />
                    <div className="mt-2 flex gap-2">
                      <button disabled={analyzing} onClick={async ()=>{
                        if (!documentText || documentText.trim().length === 0) return alert('Add document text or upload a file first');
                        try {
                          setAnalyzing(true);
                          setAnalysisResult(null);
                          const fd = new FormData();
                          if (selectedFile) {
                            fd.append('document', selectedFile);
                          } else {
                            fd.append('text', documentText);
                          }
                          fd.append('analysisType', 'contract');
                          fd.append('role', userRole || 'other');
                          const res = await fetch('/api/hil-analyzer', { method: 'POST', body: fd });
                          const j = await res.json();
                          if (!res.ok) return alert('Analysis failed: ' + (j.error || 'unknown'));
                          setAnalysisResult(j);
                          // Optionally fetch training examples for this text
                          fetchTrainingExamples(documentText);
                          // Clear selectedFile after analyze so next edits are explicit
                          setSelectedFile(null);
                        } catch (e) {
                          console.error('HIL analyze failed', e);
                          alert('Analysis failed');
                        } finally {
                          setAnalyzing(false);
                        }
                      }} className="px-3 py-2 bg-indigo-600 rounded text-sm">{analyzing ? 'Analyzing...' : 'Analyze Document'}</button>

                      <button disabled={!analysisResult} onClick={()=>{
                        if (!analysisResult) return;
                        // Set reanalysis preview to analysis result for review convenience
                        setReanalysisPreview(analysisResult);
                        alert('Analysis applied as preview — you can now Approve or Request Reanalysis');
                      }} className="px-3 py-2 bg-zinc-700 rounded text-sm">Apply Analysis Preview</button>

                      <button disabled={!analysisResult} onClick={()=>{ setAnalysisResult(null); setReanalysisPreview(null); }} className="px-3 py-2 bg-zinc-700 rounded text-sm">Clear Analysis</button>
                    </div>
                  </div>

                  <div className="mb-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-zinc-400">Analyze For Role <span className="text-xs text-zinc-500">(choose role to tailor LLM output)</span></label>
                      <div className="text-xs text-zinc-500 mb-1">Options: Freelancer, Agency, Corporate Employee, Employer, Startup Founder, HR Professional, Executive.</div>
                      <select value={userRole} onChange={(e)=>setUserRole(e.target.value)} className="w-full bg-zinc-800 p-2 rounded mt-1 text-sm">
                        <option value="">-- Select role --</option>
                        <option value="Freelancer">Freelancer</option>
                        <option value="Agency">Agency</option>
                        <option value="Corporate Employee">Corporate Employee</option>
                        <option value="Employer">Employer</option>
                        <option value="Startup Founder">Startup Founder</option>
                        <option value="HR Professional">HR Professional</option>
                        <option value="Executive">Executive</option>
                        <option value="Counsel">Counsel / Reviewer</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-zinc-400">Apply to vector store on Approve</label>
                      <div className="mt-1">
                        <label className="inline-flex items-center">
                          <input type="checkbox" checked={applyToVectorStore} onChange={(e)=>setApplyToVectorStore(e.target.checked)} className="mr-2" />
                          <span className="text-xs text-zinc-300">Store enhanced vectors for training</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <button disabled={submitting} onClick={()=>doAction('request_reanalysis')} className="px-3 py-2 bg-yellow-600 rounded mr-2">Preview Reanalysis</button>
                    <button disabled={submitting} onClick={()=>{ setApplyToVectorStore(true); doAction('approve'); }} className="px-3 py-2 bg-green-600 rounded">Approve & Vectorize</button>
                  </div>
                </div>

                {reanalysisPreview && (
                  <div className="mt-3">
                    <h4 className="font-medium">Reanalysis Preview</h4>
                    <pre className="text-xs text-zinc-300 whitespace-pre-wrap max-h-52 overflow-auto p-2 bg-zinc-800 rounded">{JSON.stringify(reanalysisPreview, null, 2)}</pre>
                  </div>
                )}

                {analysisResult && (
                  <div className="mt-3">
                    <h4 className="font-medium">Analysis Result (HIL Analyzer)</h4>
                    <div className="text-xs text-zinc-400 mb-2">Summary: <strong>{analysisResult?.initial_analysis?.risk_score ? `Risk ${analysisResult.initial_analysis.risk_score}` : '—'}</strong></div>
                    <pre className="text-xs text-zinc-300 whitespace-pre-wrap max-h-72 overflow-auto p-2 bg-zinc-800 rounded">{JSON.stringify(analysisResult, null, 2)}</pre>

                    <div className="mt-3 flex gap-2">
                      <button disabled={submitting} onClick={async ()=>{
                        if (!selected) return alert('Select an item first');
                        // Apply analysis preview and approve (accept)
                        try {
                          setSubmitting(true);
                          setReanalysisPreview(analysisResult);
                          setApplyToVectorStore(true);
                          await doAction('approve');
                        } finally { setSubmitting(false); }
                      }} className="px-3 py-2 bg-green-600 rounded">Accept</button>

                      <button disabled={submitting} onClick={async ()=>{
                        if (!selected) return alert('Select an item first');
                        setSubmitting(true);
                        try {
                          await doAction('reject');
                        } finally { setSubmitting(false); }
                      }} className="px-3 py-2 bg-red-600 rounded">Reject</button>

                      <button disabled={analyzing} onClick={async ()=>{
                        if (!documentText || documentText.trim().length === 0) return alert('Add document text or upload a file first');
                        try {
                          setAnalyzing(true);
                          setAnalysisResult(null);
                          const fd = new FormData();
                          if (selectedFile) fd.append('document', selectedFile);
                          else fd.append('text', documentText);
                          fd.append('analysisType', 'contract');
                          fd.append('analysisMode', 'deep');
                          fd.append('role', userRole || 'other');
                          const res = await fetch('/api/hil-analyzer', { method: 'POST', body: fd });
                          const j = await res.json();
                          if (!res.ok) return alert('Deep analysis failed: ' + (j.error || 'unknown'));
                          setAnalysisResult(j);
                        } catch (e) {
                          console.error('HIL deep analyze failed', e);
                          alert('Deep analysis failed');
                        } finally {
                          setAnalyzing(false);
                        }
                      }} className="px-3 py-2 bg-yellow-600 rounded">Deep Analyze</button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs text-zinc-400">Comments (optional)</label>
                  <textarea value={comment} onChange={(e)=>setComment(e.target.value)} rows={4} className="w-full bg-zinc-800 p-2 rounded mt-1 text-sm" />
                </div>

                <div className="flex gap-2 mt-2">
                  <button disabled={submitting} onClick={()=>doAction('approve')} className="px-3 py-2 bg-green-600 rounded">Approve</button>
                  <button disabled={submitting} onClick={()=>doAction('reject')} className="px-3 py-2 bg-red-600 rounded">Reject</button>
                  <button disabled={submitting} onClick={()=>doAction('request_reanalysis')} className="px-3 py-2 bg-yellow-600 rounded">Request Reanalysis</button>
                </div>

                {lastTrainingMetrics && (
                  <div className="mt-3 bg-zinc-800 p-3 rounded text-sm">
                    <h4 className="font-medium">Training Metrics</h4>
                    <div>Vectors added: {lastTrainingMetrics.vectors_added ?? 'N/A'}</div>
                    <div>Training records: {lastTrainingMetrics.training_records ?? 'N/A'}</div>
                    <div>Confidence updates: {lastTrainingMetrics.confidence_updates ?? 'N/A'}</div>
                    <div className="mt-2">
                      <button className="px-3 py-1 bg-blue-600 rounded" onClick={()=>fetchTrainingExamples(selected.payload?.document_text || (selected.analysis || selected.originalAnalysis ? JSON.stringify(selected.analysis || selected.originalAnalysis) : ''))}>View Similar Training Examples</button>
                    </div>
                  </div>
                )}

                {trainingExamples && trainingExamples.length > 0 && (
                  <div className="mt-3 bg-zinc-800 p-3 rounded text-sm">
                    <h4 className="font-medium">Similar HIL Training Examples ({trainingExamples.length})</h4>
                    <div className="space-y-2 mt-2">
                      {trainingExamples.map((ex, i) => (
                        <div key={i} className="border border-zinc-700 rounded p-2">
                          <div className="text-xs text-zinc-300">Source: {ex.source} — Score: {(ex.score * 100).toFixed(1)}%</div>
                          <div className="text-sm text-zinc-200 mt-2 whitespace-pre-wrap">{ex.text.split('\n').slice(0,4).join('\n')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}