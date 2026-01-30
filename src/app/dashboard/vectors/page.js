"use client";
import { useEffect, useState } from "react";

export default function VectorsPage() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);

  async function fetchStats() {
    setLoading(true);
    try {
      const res = await fetch('/api/vectors');
      const j = await res.json();
      if (j.stats) setStats(j.stats);
    } catch (err) {
      setActionMsg({ error: String(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchStats(); }, []);

  const [predatoryList, setPredatoryList] = useState(null);

  async function handleDelete(source) {
    if (!confirm(`Delete vectors for ${source}? This is irreversible.`)) return;
    setActionMsg(null);
    try {
      const res = await fetch('/api/vectors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', source }) });
      const j = await res.json();
      if (j.success) {
        setActionMsg({ success: `Deleted ${source}` });
        fetchStats();
      } else {
        setActionMsg({ error: j.error || 'Failed' });
      }
    } catch (err) {
      setActionMsg({ error: String(err) });
    }
  }

  async function fetchPredatory(source) {
    setActionMsg(null);
    setPredatoryList(null);
    try {
      const res = await fetch(`/api/vectors?source=${encodeURIComponent(source)}`);
      const j = await res.json();
      if (j.success) {
        setPredatoryList({ source, items: j.items });
      } else {
        setActionMsg({ error: j.error || 'Failed' });
      }
    } catch (err) {
      setActionMsg({ error: String(err) });
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Vector DB — Sources</h2>
      <p className="text-zinc-400">View ingest sources and manage stored vectors.</p>

      <div className="bg-zinc-900 p-6 rounded-lg border border-zinc-800">
        <div className="mb-4">
          <button onClick={fetchStats} className="px-3 py-2 bg-blue-600 rounded text-white">Refresh</button>
        </div>

        {loading && <div className="text-sm text-zinc-400">Loading...</div>}

        {actionMsg?.error && <div className="text-red-400">{actionMsg.error}</div>}
        {actionMsg?.success && <div className="text-green-400">{actionMsg.success}</div>}

        <div className="mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400 text-left"><th>Source</th><th>Count</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.source} className="border-t border-zinc-800">
                  <td className="py-2">{s.source}</td>
                  <td>{s.count}</td>
                  <td>{s.predatory_count ?? 0}</td>
                  <td>
                    <button onClick={() => handleDelete(s.source)} className="px-2 py-1 bg-red-600 rounded text-white mr-2">Delete</button>
                    <button onClick={() => fetchPredatory(s.source)} className="px-2 py-1 bg-yellow-600 rounded text-black">View Predatory Clauses</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {predatoryList && (
          <div className="mt-6 bg-zinc-800 p-4 rounded border border-zinc-700">
            <h4 className="font-semibold mb-2">Predatory Clauses for {predatoryList.source}</h4>
            {predatoryList.items.length === 0 ? (
              <div className="text-zinc-400">No predatory clauses detected.</div>
            ) : (
              <ul className="space-y-3">
                {predatoryList.items.map((it, idx) => (
                  <li key={idx} className="border-t border-zinc-700 pt-2">
                    <div className="text-sm"><strong>Chunk:</strong> {it.chunkId}</div>
                    <div className="text-xs text-zinc-300 mt-1">{it.text.slice(0, 500)}</div>
                    <div className="text-xs text-zinc-400 mt-1"><strong>Tags:</strong> {it.tags ? JSON.stringify(it.tags) : 'None'}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}