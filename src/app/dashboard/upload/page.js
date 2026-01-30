"use client";
import { useState } from "react";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setStatus('Uploading...');
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      setStatus(JSON.stringify(data, null, 2));
    } catch (err) {
      setStatus('Upload failed: ' + String(err));
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Upload Contract (PDF)</h2>
      <form onSubmit={handleUpload} className="space-y-4">
        <input type="file" accept="application/pdf" onChange={(e)=> setFile(e.target.files?.[0] || null)} />
        <button className="px-4 py-2 bg-indigo-600 text-white rounded">Upload</button>
      </form>

      {status && (
        <pre className="mt-4 p-4 bg-gray-100 rounded text-sm overflow-auto">{status}</pre>
      )}
    </div>
  );
}
