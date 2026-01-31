import vectorDb from './vectorDb';
import { generateEmbedding } from './embeddings';

export async function storeFeedbackEmbedding(feedback) {
  try {
    // Normalize feedback object
    const fb = typeof feedback.toObject === 'function' ? feedback.toObject() : feedback;
    const type = fb.type || 'analysis';

    // Build embedding text according to type
    let text = '';
    if (type === 'chat') {
      const q = fb.originalAnalysis?.question || '';
      const a = fb.originalAnalysis?.answer || '';
      text = `CHAT QUESTION:\n${q}\n\nCHAT ANSWER:\n${a}\n\nEXPERT_COMMENTS:\n${fb.comments || ''}\n\nSUGGESTIONS:\n${fb.suggestions || ''}`;
    } else if (type === 'resume') {
      text = `RESUME SCREENING RESULT:\n${JSON.stringify(fb.originalAnalysis || fb.payload || {})}`;
    } else {
      // analysis, upload, default
      text = `FEEDBACK (${type.toUpperCase()}):\n${fb.documentName || ''}\n\nANALYSIS:\n${JSON.stringify(fb.originalAnalysis || {})}\n\nCOMMENTS:\n${fb.comments || ''}\n\nSUGGESTIONS:\n${fb.suggestions || ''}`;
    }

    // Truncate if too long
    if (text.length > 3000) text = text.slice(0, 3000);

    const embedding = await generateEmbedding(text);

    const vectors = [
      {
        text,
        embedding,
        metadata: {
          source: `feedback:${fb._id}`,
          chunkId: 0,
          page: null,
        },
        tags: {
          type: fb.type || 'analysis',
          feedbackId: String(fb._id),
          userEmail: fb.userEmail || null,
          expertEmail: fb.expertEmail || null,
        },
      },
    ];

    await vectorDb.addVectors(vectors);
    return true;
  } catch (err) {
    console.warn('Failed to store feedback embedding:', err?.message || err);
    return false;
  }
}
