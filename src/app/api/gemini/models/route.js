import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  const desired = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 400 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // listModels may return an array or object depending on client; handle both
    const res = await genAI.listModels();
    let models = [];
    if (Array.isArray(res)) models = res;
    else if (res?.models) models = res.models;
    else models = res;

    const found = models.some((m) => {
      const name = (m?.name || m?.model || m)?.toString?.() || '';
      return name.includes(desired) || name === desired;
    });

    return NextResponse.json({ ok: true, desired, found, models: models.slice?.(0, 50) || models });
  } catch (err) {
    console.error('Error listing Gemini models:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}