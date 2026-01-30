import { NextResponse } from 'next/server';
import { generateEmbedding } from '@/lib/embeddings';
import vectorDb from '@/lib/vectorDb';
import { ollamaClient } from '@/lib/llm';
import { aggregateReferences, perChunkReferences } from '@/lib/legalRefs';

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (err) {
      // Try reading raw text to give a better error message
      const raw = await request.text();
      console.error('Invalid JSON body received for /api/chat:', raw);
      return NextResponse.json(
        { error: 'Invalid JSON body. Expected JSON like { "question": "your question", "india_only": true, "debug": true }' },
        { status: 400 }
      );
    }

    const { question, filename } = body || {};

    if (!question || !question.trim()) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    console.log('Generating question embedding...');
    // Generate embedding for the question
    const questionEmbedding = await generateEmbedding(question);

    console.log('Searching vector database...');
    // Search vector database
    const filter = filename
      ? {
          must: [
            {
              key: 'source',
              match: { value: filename },
            },
          ],
        }
      : null;

    const searchResults = await vectorDb.search(
      questionEmbedding,
      5,
      filter
    );

    if (searchResults.length === 0) {
      return NextResponse.json({
        answer: "I don't know",
        sources: [],
      });
    }

    console.log(`Found ${searchResults.length} relevant chunks`);

    // Build context from search results
    const context = searchResults
      .map(
        (result, idx) =>
          `[Chunk ${idx + 1}] (Source: ${result.source}, Page: ${result.page || 'N/A'})\n${result.text}`
      )
      .join('\n\n');

    // Extract legal references (laws & clause categories) from the retrieved chunks
    const legalRefs = aggregateReferences(searchResults);
    const perChunkRefs = perChunkReferences(searchResults);

    // Build system prompt for strict RAG
    let systemPrompt = `You are a helpful assistant that answers questions based STRICTLY on the provided context from uploaded PDF documents.

CRITICAL RULES:
1. Use ONLY the information from the context below
2. If the answer is not in the context, respond EXACTLY with: "I don't know"
3. Do not make assumptions or use external knowledge
4. Be concise and accurate
5. Cite the source and chunk when possible

CONTEXT:
${context}`;

    // If the user specifically requested India-only advice, add that instruction
    if (body.india_only) {
      systemPrompt += `\n\nIMPORTANT: Focus ONLY on Indian law (Indian Contract Act, 1872 and related principles). If the context does not indicate India-specific law, say "I don't know".`;
    }

    console.log('Calling Qwen via Ollama...');
    // Call Qwen for answer
    const answer = await ollamaClient.chat(
      [
        {
          role: 'user',
          content: question,
        },
      ],
      systemPrompt
    );

    // Aggregate law/clause references and attach metadata
    const lawSummary = Object.keys(legalRefs.laws).map((law) => ({ law, occurrences: legalRefs.laws[law] }));
    const clauseSummary = Object.keys(legalRefs.clauses).map((cat) => ({ category: cat, occurrences: legalRefs.clauses[cat] }));

    // Check if the model said it doesn't know
    const lowerAnswer = answer.toLowerCase().trim();
    const unknownPhrases = [
      "i don't know",
      "i do not know",
      "not mentioned",
      "not found in the context",
      "no information",
      "not provided",
    ];

    const isUnknown = unknownPhrases.some((phrase) =>
      lowerAnswer.includes(phrase)
    );

    const sources = searchResults.map((r, idx) => ({
      source: r.source,
      page: r.page,
      score: r.score,
      chunk: idx + 1,
      snippet: r.text.slice(0, 300),
      laws: perChunkRefs[idx]?.laws || [],
      clauses: (perChunkRefs[idx]?.clauses || []).map(c => ({ category: c.category, snippet: c.snippet }))
    }));

    const responsePayload = {
      answer: isUnknown ? "I don't know" : answer,
      sources,
      legal: {
        laws: lawSummary,
        clauses: clauseSummary,
      },
    };

    if (body.debug) {
      responsePayload.chunks = searchResults.map((r, i) => ({ chunk: i + 1, text: r.text, source: r.source, refs: perChunkRefs[i] }));
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Error in chat:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process question' },
      { status: 500 }
    );
  }
}
