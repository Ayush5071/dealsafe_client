import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import vectorDb from '@/lib/vectorDb';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const source = url.searchParams.get('source');
    if (source) {
      // Return predatory clauses for a specific source
      const rows = await vectorDb.db.prepare('SELECT chunkId, text, tags FROM documents WHERE source = ? AND tags LIKE ?').all(source, '%"is_predatory":true%');
      const items = rows.map((r) => ({ chunkId: r.chunkId, text: r.text, tags: r.tags ? JSON.parse(r.tags) : {} }));
      return NextResponse.json({ success: true, source, items });
    }

    const stats = await vectorDb.getSourceStats();
    return NextResponse.json({ success: true, stats });
  } catch (err) {
    console.error('Error fetching vector stats:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, source } = body;
    if (action === 'delete' && source) {
      await vectorDb.deleteBySource(source);
      // Also remove uploaded file from uploads/ if it exists (cleanup for uploaded files)
      try {
        const uploadPath = path.join(process.cwd(), 'uploads', source);
        if (fs.existsSync(uploadPath)) {
          fs.unlinkSync(uploadPath);
          console.log(`Deleted upload file for source: ${source}`);
        }
      } catch (e) {
        console.warn('Failed to delete upload file for source:', source, e?.message || e);
      }
      return NextResponse.json({ success: true, source });
    }
    return NextResponse.json({ error: 'Invalid action or missing source' }, { status: 400 });
  } catch (err) {
    console.error('Error handling vectors POST:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}