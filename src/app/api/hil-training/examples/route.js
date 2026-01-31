import { NextResponse } from 'next/server';
import { getHILTrainingExamples } from '@/lib/hilTraining';

export async function POST(req) {
  try {
    const body = await req.json();
    const { text = '', limit = 5 } = body || {};
    if (!text || text.trim().length === 0) {
      return NextResponse.json({ examples: [], count: 0 });
    }

    const examples = await getHILTrainingExamples(text, limit);
    return NextResponse.json({ examples, count: examples.length });
  } catch (err) {
    console.error('Failed to fetch HIL training examples:', err);
    return NextResponse.json({ error: err?.message || 'Failed to fetch examples' }, { status: 500 });
  }
}