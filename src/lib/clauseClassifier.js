import { ollamaClient } from './llm';
import { extractLegalReferences } from './legalRefs';

// Classify a single chunk using local model; return tags object
export async function classifyChunk(chunkText) {
  // Basic heuristic first
  const heur = extractLegalReferences(chunkText);

  // Ask Ollama to produce structured tags (category, is_predatory, laws, reason, rewrite)
  const system = `You are a legal classifier that tags a short contract clause. Output ONLY a JSON object with keys: category (one of: payment, termination, liability, IP, confidentiality, assignment, indemnity, limitation of liability, dispute resolution, jurisdiction, miscellaneous), is_predatory (true|false), laws (array of strings), clause_name (short string), reason (brief), rewrite_suggestion (optional). Respond with ONLY the JSON object.`;
  const user = `Clause text:\n${chunkText}`;

  try {
    const resp = await ollamaClient.chat([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);

    const m = resp.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No JSON');
    const parsed = JSON.parse(m[0]);
    // normalize
    parsed.category = (parsed.category || 'miscellaneous').toLowerCase();
    parsed.is_predatory = Boolean(parsed.is_predatory);
    parsed.laws = parsed.laws || heur.laws || [];
    parsed.reason = parsed.reason || '';
    return parsed;
  } catch (err) {
    // fallback to heuristic
    const category = heur.clauses?.[0]?.category || 'miscellaneous';
    return {
      category,
      is_predatory: false,
      laws: heur.laws || [],
      clause_name: category,
      reason: 'Heuristic fallback',
    };
  }
}

export async function classifyChunks(chunks) {
  const results = [];
  for (const chunk of chunks) {
    const tag = await classifyChunk(chunk).catch(() => ({ category: 'miscellaneous', is_predatory: false, laws: [], clause_name: '', reason: 'error' }));
    results.push(tag);
  }
  return results;
}