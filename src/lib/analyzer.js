import vectorDb from './vectorDb';
import { geminiClient, ollamaClient } from './llm';
import { ContractAnalysisSchema } from './schemas';
import { CONFIG } from './config';

// Analyze a file by filename (source in vector DB)
export async function analyzeFile(filename) {
  // Retrieve chunks
  const chunks = await vectorDb.getAllBySource(filename);
  if (!chunks || chunks.length === 0) {
    throw new Error('No data found for the specified file');
  }

  // Build context from chunks (include chunk index for reference)
  const context = chunks
    .map((c, i) => `[Chunk ${i + 1}] (Source: ${c.source}, Page: ${c.page || 'N/A'})\n${c.text}`)
    .join('\n\n');

  // Truncate context if too long
  let finalContext = context;
  if (finalContext.length > CONFIG.MAX_CONTEXT_LENGTH) {
    finalContext = finalContext.substring(0, CONFIG.MAX_CONTEXT_LENGTH) + '\n\n[... content truncated ...]';
  }

  // Build India-centric analysis prompt
  const analysisPrompt = `You are a legal contract analysis engine focused on Indian law (Indian Contract Act, 1872 and relevant principles). Analyze the following contract text and return a STRICT JSON object that conforms to the schema described below. Do NOT include any text outside the JSON object.\n\nREQUIREMENTS:\n- Segment the contract into clauses and name each clause (clause_name).\n- For each clause, classify into categories (payment, termination, liability, IP, confidentiality, assignment, indemnity, limitation of liability, dispute resolution, jurisdiction, miscellaneous).\n- For each clause, give: clause_text (if available), category, risk_level (low/medium/high/critical), risk_score (0-100), concise description, recommendations, optional india_laws (list of relevant sections/principles), and a rewrite_suggestion for safer wording.\n- Detect predatory or unenforceable clauses under Indian law and calculate a predatory_index (0-100).\n- Provide missing_clauses (list of recommended clauses), negotiation_questions to ask, an overall final_score (0-100), trust_score (0-100), a short summary, and top-level recommendations.\n\nCONTEXT:\n${finalContext}\n\nOUTPUT: A single JSON object matching the ContractAnalysisSchema. Use arrays and numbers, do not include commentary.`;

  // Strict analysis prompt (India-only, context-only)
  const analysisPromptStrict = `CRITICAL RULES:\n1. Use ONLY the information contained in the CONTEXT below. If any question or requirement cannot be answered from the context, respond exactly with the string: "I don't know".\n2. Focus ONLY on Indian law (Indian Contract Act, 1872 and related principles). Map clause risks precisely to Indian legal principles and explain why.\n3. Output exactly one strict JSON object and nothing else that conforms to the ContractAnalysisSchema.\n\nYou are a legal contract analysis engine focused on Indian law. Analyze the following contract text and return a STRICT JSON object that conforms to the schema described below. Do NOT include any text outside the JSON object.\n\nCONTEXT:\n${finalContext}\n\nOUTPUT: A single JSON object matching the ContractAnalysisSchema. Use arrays and numbers, do not include commentary.`;

  // Try Gemini first (if available), but fall back to Ollama on any failure
  if (geminiClient && geminiClient.available) {
    try {
      const analysis = await geminiClient.analyzeContract(analysisPromptStrict, ContractAnalysisSchema);
      return analysis;
    } catch (err) {
      console.warn('Gemini analysis failed, falling back to local model (Ollama). Error:', err?.message || err);
    }
  }

  // Fallback to Ollama (Qwen)
  const systemPrompt = `You are a legal contract analysis expert. Output ONLY a valid JSON object that conforms to the following schema: final_score (0-100), summary (string), clauses (array of objects with clause_name, clause_text (optional), category (string), risk_level (low|medium|high|critical), risk_score (0-100), description (string), recommendations (string), india_laws (array optional), rewrite_suggestion (optional)). Include optional fields: predatory_index, trust_score, missing_clauses, negotiation_questions, recommendations.`;

  const modelResponse = await ollamaClient.chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: analysisPromptStrict },
  ]);

  const jsonMatch = modelResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to extract JSON from model response');
  }
  const parsed = JSON.parse(jsonMatch[0]);
  ContractAnalysisSchema.parse(parsed);
  return parsed;
}