"use client";
import { useEffect, useState } from 'react';

export default function MyReviewsPage(){
  const [loading,setLoading]=useState(true);
  const [items,setItems]=useState([]);
  const [comment,setComment]=useState('');
  const [selected, setSelected]=useState(null);

  useEffect(()=>{ fetchMyReviews(); },[]);

  async function fetchMyReviews(){
    setLoading(true);
    try{
      const res = await fetch('/api/user/feedback');
      const j = await res.json();
      setItems(j.feedbacks || []);
    }catch(e){ console.error(e); }
    setLoading(false);
  }

  async function submitUserFeedback(feedbackId){
    if(!feedbackId || !comment) return alert('Comment required');
    try{
      const res = await fetch('/api/user/feedback', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ feedbackId, comment })});
      if(!res.ok) throw new Error('Failed');
      alert('Feedback submitted to experts');
      setComment('');
      fetchMyReviews();
    }catch(e){ console.error(e); alert('Failed to submit'); }
  }

  if(loading) return <div className="text-zinc-400">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">My Reviews</h1>
      <p className="text-zinc-400 mb-4">View analyses you've requested and send feedback or ask for clarification from experts.</p>

      {items.length===0 && <div className="text-zinc-400">No reviews yet</div>}

      <div className="space-y-4">
        {items.map(it=> (
          <div key={it._id} className="bg-zinc-900 p-4 border border-zinc-800 rounded">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-semibold text-white">{it.documentName}</div>
                <div className="text-zinc-400 text-sm">Status: {it.status}</div>
              </div>
              <div className="text-sm text-zinc-400">{new Date(it.createdAt).toLocaleString()}</div>
            </div>

            <div className="mt-3 text-zinc-300 text-sm">
              <pre className="whitespace-pre-wrap">{JSON.stringify(it.originalAnalysis || it.payload || {}, null, 2)}</pre>
            </div>

            <div className="mt-3 flex gap-2">
              <input className="flex-1 bg-zinc-800 p-2 rounded" value={comment} onChange={(e)=>setComment(e.target.value)} placeholder="Send a comment to experts" />
              <button className="px-3 py-2 bg-blue-600 rounded" onClick={()=>submitUserFeedback(it._id)}>Send</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}