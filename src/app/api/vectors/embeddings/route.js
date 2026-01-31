import { NextResponse } from 'next/server';
import vectorDb from '@/lib/vectorDb';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const source = url.searchParams.get('source');

    const vectors = await vectorDb.getVectorsWithEmbeddings(source || null);

    return NextResponse.json({ success: true, count: vectors.length, vectors });
  } catch (err) {
    console.error('GET /api/vectors/embeddings error', err);
    return NextResponse.json({ error: 'Failed to fetch embeddings' }, { status: 500 });
  }
}