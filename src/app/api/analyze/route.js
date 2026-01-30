import { NextResponse } from 'next/server';
import { analyzeFile } from '@/lib/analyzer';

export async function POST(request) {
  try {
    const body = await request.json();
    const { filename } = body;

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    console.log('Running analysis for:', filename);

    try {
      const analysis = await analyzeFile(filename);
      return NextResponse.json({ success: true, filename, analysis });
    } catch (err) {
      console.error('Analysis failed:', err);
      return NextResponse.json({ error: err.message || 'Analysis failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error analyzing contract:', error);
    
    // Handle validation errors
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid analysis format received from AI' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to analyze contract' },
      { status: 500 }
    );
  }
}
