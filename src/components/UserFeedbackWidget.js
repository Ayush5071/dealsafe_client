"use client";
import { useState } from 'react';

export default function UserFeedbackWidget({ analysis, analysisId, documentName, onSubmitted, onRequestReanalysis }) {
  const [verdict, setVerdict] = useState('good');
  const [tags, setTags] = useState('');
  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submitFeedback() {
    if (!analysisId || !documentName) return alert('Missing analysis or document ID');
    setSubmitting(true);
    try {
      const res = await fetch('/api/user/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          create: true,
          analysisId,
          documentName,
          originalAnalysis: analysis || {},
          verdict,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          rating,
          comments
        })
      });
      const j = await res.json();
      if (j.success) {
        alert('Thanks — feedback submitted');
        setComments('');
        setTags('');
        if (onSubmitted) onSubmitted(j.feedback);
      } else {
        alert('Failed to submit feedback: ' + (j.error || 'unknown'));
      }
    } catch (err) {
      console.error('Submit feedback error:', err);
      alert('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-4 rounded">
      <h4 className="font-semibold mb-2">Give feedback</h4>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-zinc-400">Verdict</label>
          <select value={verdict} onChange={(e) => setVerdict(e.target.value)} className="w-full bg-zinc-800 p-2 rounded mt-1">
            <option value="good">Good</option>
            <option value="bad">Bad</option>
            <option value="relevant">Relevant</option>
            <option value="irrelevant">Irrelevant</option>
            <option value="request_reanalysis">Request reanalysis</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-400">Rating (1-5)</label>
          <input type="number" min="1" max="5" value={rating} onChange={(e)=>setRating(parseInt(e.target.value||5))} className="w-full bg-zinc-800 p-2 rounded mt-1" />
        </div>
      </div>

      <div className="mb-3">
        <label className="text-xs text-zinc-400">Tags (comma separated)</label>
        <input value={tags} onChange={(e)=>setTags(e.target.value)} className="w-full bg-zinc-800 p-2 rounded mt-1" placeholder="reliability,missing-clause" />
      </div>

      <div className="mb-3">
        <label className="text-xs text-zinc-400">Comments</label>
        <textarea value={comments} onChange={(e)=>setComments(e.target.value)} rows={4} className="w-full bg-zinc-800 p-2 rounded mt-1" placeholder="Optional notes for experts or to explain the verdict"></textarea>
      </div>

      <div className="flex gap-3 justify-end">
        <button
          onClick={() => { if (onRequestReanalysis) onRequestReanalysis(); else alert('Request reanalysis - you can also set verdict Request reanalysis') }}
          className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded"
          disabled={submitting}
        >Request Reanalysis</button>
        <button
          onClick={submitFeedback}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
          disabled={submitting}
        >{submitting ? 'Submitting...' : 'Submit Feedback'}</button>
      </div>
    </div>
  );
}