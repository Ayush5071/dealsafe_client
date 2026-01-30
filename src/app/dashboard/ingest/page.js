"use client";
import { useState } from "react";

export default function IngestPage() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleAddFiles(e) {
    setFiles(Array.from(e.target.files || []));
  }

  async function handleUploadAll() {
    if (files.length === 0) return setMessage({ error: 'No files selected' });
    setUploading(true);
    setMessage(null);

    try {
      for (const f of files) {
        const form = new FormData();
        form.append('file', f);
        await fetch('/api/upload', { method: 'POST', body: form });
      }
      // After upload, call ingest to process local pdfs folder if desired
      const res = await fetch('/api/ingest', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({}) });
      const j = await res.json();
      setMessage({ success: true, processed: j.processedChunks });
      setFiles([]);
    } catch (err) {
      setMessage({ error: String(err) });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Ingest PDFs</h2>
      <p className="text-zinc-400">Upload PDFs here and ingest them into the vector DB.</p>

      <div className="bg-zinc-900 p-6 rounded-lg border border-zinc-800">
        <input type="file" accept="application/pdf" multiple onChange={handleAddFiles} />
        <div className="mt-4">
          <button onClick={handleUploadAll} disabled={uploading || files.length===0} className="px-4 py-2 bg-blue-600 rounded text-white">{uploading ? 'Uploading...' : 'Upload & Ingest Selected'}</button>
        </div>
        {files.length > 0 && (
          <div className="mt-4 text-sm text-zinc-300">
            <strong>Selected:</strong>
            <ul className="list-disc ml-6">
              {files.map((f, idx) => <li key={idx}>{f.name}</li>)}
            </ul>
          </div>
        )}

        {message && (
          <div className="mt-4 text-sm">
            {message.error ? <div className="text-red-400">{message.error}</div> : <div className="text-green-400">Ingested. Processed chunks: {message.processed}</div>}
          </div>
        )}
      </div>
    </div>
  );
}