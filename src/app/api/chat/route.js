import { NextResponse } from 'next/server';
import { generateEmbedding } from '@/lib/embeddings';
import vectorDb from '@/lib/vectorDb';
import { ollamaClient } from '@/lib/llm';
import { aggregateReferences, perChunkReferences } from '@/lib/legalRefs';
import { connectMongoose } from '@/lib/mongoose';
import Feedback from '@/lib/models/Feedback';
import { ensureAdminSetup, getUserProfile } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { submitForExpertReview } from '@/lib/hilOrchestrator';

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

    // Add language instruction if specified
    const language = body.language || 'en';
    const languageNames = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'hi': 'Hindi',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ar': 'Arabic',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'it': 'Italian',
      'ko': 'Korean'
    };

    const languageName = languageNames[language] || 'English';

    if (language !== 'en') {
      systemPrompt += `\n\nIMPORTANT: Respond in ${languageName}. Translate your entire response to ${languageName}.`;
    }

    console.log('Calling Qwen via Ollama...');
    // Call Qwen for answer (always in English)
    const answer = await ollamaClient.chat(
      [
        {
          role: 'user',
          content: question,
        },
      ],
      systemPrompt
    );

    // Translate answer if needed using LibreTranslate (FREE!)
    let finalAnswer = answer;
    if (language !== 'en') {
      try {
        const freeTranslate = await import('@/lib/freeTranslate');
        finalAnswer = await freeTranslate.translateText(answer, language);
        console.log(`Translated answer to ${languageName} using LibreTranslate`);
      } catch (err) {
        console.warn('Translation failed, using original answer:', err);
        finalAnswer = answer;
      }
    }

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
      answer: isUnknown ? "I don't know" : finalAnswer,
      sources,
      legal: {
        laws: lawSummary,
        clauses: clauseSummary,
      },
    };

    if (body.debug) {
      responsePayload.chunks = searchResults.map((r, i) => ({ chunk: i + 1, text: r.text, source: r.source, refs: perChunkRefs[i] }));
    }

    // If HIL requested (body.useHIL===true or header), submit; otherwise continue normal flow
    try {
      const useHIL = (body && body.useHIL === true) || (request.headers?.get('x-use-hil') === 'true');
      const session = await getServerSession();
      const userEmail = session?.user?.email || 'anonymous@local';
      const profile = await getUserProfile(userEmail).catch(() => null);
      const isExpert = !!profile?.isExpert || !!profile?.expert || !!profile?.isAdmin;

      if (useHIL && filename) {
        // Submit to HIL system (blocking) when requested
        const hilResult = await submitForExpertReview(
          { question, answer: responsePayload.answer },
          userEmail,
          'chat',
          {
            documentName: filename || 'chat',
            sources: responsePayload.sources,
            legal: responsePayload.legal,
            user_role: profile?.role || 'unknown'
          }
        );

        return NextResponse.json({ hil_mandatory: true, hil_id: hilResult.hil_id, analysis_id: hilResult.analysis_id, status: hilResult.status, message: hilResult.message, estimated_review_time: hilResult.estimated_review_time });
      }

      // If the current user is an expert, create a feedback record linked to this chat so the expert can accept/reject and trigger re-answers.
      if (isExpert) {
        await connectMongoose();
        const defaultAdmin = (process.env.DEFAULT_ADMIN_EMAILS || 'ayusht5071@gmail.com').split(',')[0].trim().toLowerCase();
        await ensureAdminSetup(defaultAdmin);

        const feedbackRecord = new Feedback({
          analysisId: `chat_${Date.now()}`,
          type: 'chat',
          documentName: filename || 'chat',
          userEmail: userEmail,
          expertEmail: userEmail,
          expertName: profile?.name || '',
          originalAnalysis: { question, answer: responsePayload.answer },
          payload: { sources: responsePayload.sources, legal: responsePayload.legal },
          status: 'pending_expert_review'
        });

        await feedbackRecord.save();
        // store embedding for the created feedback (for training/search)
        try {
          const { storeFeedbackEmbedding } = await import('@/lib/feedbackEmbeddings');
          storeFeedbackEmbedding(feedbackRecord).catch((e) => console.warn('storeFeedbackEmbedding error:', e));
        } catch (e) {
          console.warn('Failed to queue feedback embedding:', e?.message || e);
        }

        responsePayload.feedback_id = feedbackRecord._id;
        responsePayload.expert_mode = true;
        responsePayload.feedback_status = feedbackRecord.status;

        return NextResponse.json(responsePayload);
      }

      // Non-expert default: do not create feedback or training entries unless explicitly requested.
      const createFeedback = (body && body.createFeedback === true) || (request.headers?.get('x-create-feedback') === 'true');
      if (createFeedback) {
        try {
          await connectMongoose();
          const defaultAdmin = (process.env.DEFAULT_ADMIN_EMAILS || 'ayusht5071@gmail.com').split(',')[0].trim().toLowerCase();
          await ensureAdminSetup(defaultAdmin);

          const feedbackRecord = new Feedback({
            analysisId: `chat_${Date.now()}`,
            type: 'chat',
            documentName: filename || 'chat',
            userEmail: userEmail,
            expertEmail: defaultAdmin,
            originalAnalysis: { question, answer: responsePayload.answer },
            payload: { sources: responsePayload.sources, legal: responsePayload.legal },
            status: 'pending'
          });

          await feedbackRecord.save();
          try {
            const { storeFeedbackEmbedding } = await import('@/lib/feedbackEmbeddings');
            storeFeedbackEmbedding(feedbackRecord).catch((e) => console.warn('storeFeedbackEmbedding error:', e));
          } catch (e) {
            console.warn('Failed to queue feedback embedding:', e?.message || e);
          }

          responsePayload.feedback_id = feedbackRecord._id;
          responsePayload.feedback_assigned_to = defaultAdmin;
        } catch (e) {
          console.warn('Failed to create chat feedback entry:', e?.message || e);
        }
      }

      return NextResponse.json(responsePayload);
    } catch (e) {
      console.warn('Failed to process HIL/feedback for chat (non-fatal):', e?.message || e);
      return NextResponse.json(responsePayload);
    }
  } catch (error) {
    console.error('Error in chat:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process question' },
      { status: 500 }
    );
  }
}
