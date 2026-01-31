import vectorDb from './vectorDb';
import { geminiClient, ollamaClient } from './llm';
import { ContractAnalysisSchema } from './schemas';
import { CONFIG } from './config';
import { generateHILAwarePrompt } from './hilTraining';

// Analyze a file by filename (source in vector DB)
export async function analyzeFile(filename, language = 'en') {
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

  // RAG: fetch related external context using embeddings stored in vector DB
  try {
    const { generateEmbedding } = await import('./embeddings');
    const queryText = chunks.slice(0, 6).map((c) => c.text).join('\n\n');

    // Run embedding search and Firecrawl scraping in parallel
    const [qVec, firecrawlModule] = await Promise.all([
      generateEmbedding(queryText),
      import('./firecrawlAgent').catch(() => null)
    ]);

    const searchPromise = vectorDb.search(qVec, 6, null);
    const firecrawlPromise = (firecrawlModule && firecrawlModule.scrapeRelatedClauses)
      ? firecrawlModule.scrapeRelatedClauses(queryText)
      : Promise.resolve([]);

    const [related, scrapedClauses] = await Promise.all([searchPromise, firecrawlPromise]);

    // Exclude same file
    const external = (related || []).filter(r => r.source !== filename).slice(0, 6);
    if (external.length) {
      const externalContext = external.map((e, i) => `[External ${i + 1}] Source: ${e.source} (score: ${e.score.toFixed(3)})\n${e.text}`).join('\n\n');
      finalContext = `${finalContext}\n\nEXTERNAL CONTEXT:\n${externalContext}`;
      // attach to return for transparency
      var externalContexts = external;
    }

    // If Firecrawl returned clauses, append them to context as lower-confidence 'tool' evidence
    if (Array.isArray(scrapedClauses) && scrapedClauses.length > 0) {
      const fcContext = scrapedClauses.map((c, i) => `[Firecrawl ${i + 1}] ${c.title || 'External clause'} (source: ${c.source}, confidence: ${Number(c.confidence || 0).toFixed(2)})\n${c.text}`).join('\n\n');
      finalContext = `${finalContext}\n\nEXTERNAL SCRAPED CLAUSES (Firecrawl):\n${fcContext}`;
      var firecrawlContexts = scrapedClauses;
    }
  } catch (err) {
    console.warn('Failed to fetch external contexts for analyzer:', err);
  }

  // Language names for prompt
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
  const languageInstruction = language !== 'en'
    ? `\n\nIMPORTANT: Provide the entire analysis output in ${languageName}. Translate all fields including summary, descriptions, recommendations, and clause text to ${languageName}.`
    : '';

  // Build India-centric analysis prompt
  const analysisPrompt = `You are a legal contract analysis engine focused on Indian law (Indian Contract Act, 1872 and relevant principles). Analyze the following contract text and return a STRICT JSON object that conforms to the schema described below. Do NOT include any text outside the JSON object.\n\nREQUIREMENTS:\n- Segment the contract into clauses and name each clause (clause_name).\n- For each clause, classify into categories (payment, termination, liability, IP, confidentiality, assignment, indemnity, limitation of liability, dispute resolution, jurisdiction, miscellaneous).\n- For each clause, give: clause_text (if available), category, risk_level (low/medium/high/critical), risk_score (0-100), concise description, recommendations, optional india_laws (list of relevant sections/principles), and a rewrite_suggestion for safer wording.\n- Detect predatory or unenforceable clauses under Indian law and calculate a predatory_index (0-100).\n- Provide missing_clauses (list of recommended clauses), negotiation_questions to ask, an overall final_score (0-100), trust_score (0-100), a short summary, and top-level recommendations.${languageInstruction}\n\nCONTEXT:\n${finalContext}\n\nOUTPUT: A single JSON object matching the ContractAnalysisSchema. Use arrays and numbers, do not include commentary.`;

  // Strict analysis prompt (India-only, context-only)
  const analysisPromptStrict = `CRITICAL RULES:\n1. Use ONLY the information contained in the CONTEXT below. If any question or requirement cannot be answered from the context, respond exactly with the string: "I don't know".\n2. Focus ONLY on Indian law (Indian Contract Act, 1872 and related principles). Map clause risks precisely to Indian legal principles and explain why.\n3. Output exactly one strict JSON object and nothing else that conforms to the ContractAnalysisSchema.${languageInstruction}\n\nYou are a legal contract analysis engine focused on Indian law. Analyze the following contract text and return a STRICT JSON object that conforms to the schema described below. Do NOT include any text outside the JSON object.\n\nCONTEXT:\n${finalContext}\n\nOUTPUT: A single JSON object matching the ContractAnalysisSchema. Use arrays and numbers, do not include commentary.`;

  // Try Gemini first (if available), but fall back to Ollama on any failure
  if (geminiClient && geminiClient.available) {
    try {
      const analysis = await geminiClient.analyzeContract(analysisPromptStrict, ContractAnalysisSchema);
      return { analysis, external_contexts: externalContexts || [] };
    } catch (err) {
      console.warn('Gemini analysis failed, falling back to local model (Ollama). Error:', err?.message || err);
    }
  }

  // Fallback to Ollama (Qwen)
  const systemPrompt = `You are a legal contract analysis expert. Output ONLY a valid JSON object that conforms to the following schema: final_score (0-100), summary (string), clauses (array of objects with clause_name, clause_text (optional), category (string), risk_level (low|medium|high|critical), risk_score (0-100), description (string), recommendations (string), india_laws (array optional), rewrite_suggestion (optional)). Include optional fields: predatory_index, trust_score, missing_clauses, negotiation_questions, recommendations.${languageInstruction}`;

  const modelResponseRaw = await ollamaClient.chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: analysisPromptStrict },
  ]);

  const modelResponse = typeof modelResponseRaw === 'string' ? modelResponseRaw : JSON.stringify(modelResponseRaw);

  const jsonMatch = modelResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to extract JSON from model response');
  }
  const parsed = JSON.parse(jsonMatch[0]);
  ContractAnalysisSchema.parse(parsed);

  // Store analysis ID for expert review tracking
  const analysisId = `analysis_${filename}_${Date.now()}`;
  parsed.analysisId = analysisId;
  parsed.documentName = filename;
  parsed.requiresExpertReview = true; // All analyses can be reviewed by experts

  // Tools used metadata
  const toolsUsed = [];
  if (externalContexts && externalContexts.length) toolsUsed.push('vector_db');
  if (typeof firecrawlContexts !== 'undefined' && Array.isArray(firecrawlContexts) && firecrawlContexts.length) toolsUsed.push('firecrawl');

  return {
    analysis: parsed,
    external_contexts: externalContexts || [],
    firecrawl_clauses: firecrawlContexts || [],
    tools_used: toolsUsed,
    analysisId
  };
}

/**
 * Analyze free-form document text (used for re-analysis and expert-supplied text)
 * @param {string} documentText
 * @param {string} documentName
 * @param {string} userRole
 */
export async function analyzeText(documentText, documentName = 'text_doc', userRole = '') {
  // Build base context from provided text
  let finalContext = documentText || '';

  // Add HIL-aware prompt context (similar training examples)
  try {
    const hil = await generateHILAwarePrompt(documentText || '', userRole || '');
    if (hil?.hil_context) finalContext = `${finalContext}\n\n${hil.hil_context}`;
  } catch (err) {
    console.warn('Failed to generate HIL-aware prompt:', err);
  }

  // Try to retrieve related external context via embeddings + Firecrawl
  let externalContexts = [];
  let firecrawlContexts = [];

  try {
    const { generateEmbedding } = await import('./embeddings');
    const queryText = (documentText || '').substring(0, 2000);
    const qVec = await generateEmbedding(queryText);

    const [related, firecrawlModule] = await Promise.all([
      vectorDb.search(qVec, 6, null),
      import('./firecrawlAgent').catch(() => null)
    ]);

    const external = (related || []).slice(0, 6);
    if (external.length) {
      const externalContext = external.map((e, i) => `[External ${i + 1}] Source: ${e.source} (score: ${e.score.toFixed(3)})\n${e.text}`).join('\n\n');
      finalContext = `${finalContext}\n\nEXTERNAL CONTEXT:\n${externalContext}`;
      externalContexts = external;
    }

    if (firecrawlModule && firecrawlModule.scrapeRelatedClauses) {
      const scrapedClauses = await firecrawlModule.scrapeRelatedClauses(queryText);
      if (Array.isArray(scrapedClauses) && scrapedClauses.length) {
        const fcContext = scrapedClauses.map((c, i) => `[Firecrawl ${i + 1}] ${c.title || 'External clause'} (source: ${c.source}, confidence: ${Number(c.confidence || 0).toFixed(2)})\n${c.text}`).join('\n\n');
        finalContext = `${finalContext}\n\nEXTERNAL SCRAPED CLAUSES (Firecrawl):\n${fcContext}`;
        firecrawlContexts = scrapedClauses;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch external contexts for analyzer (text):', err);
  }

  // Build the same strict prompt as analyzeFile
  const analysisPromptStrict = `CRITICAL RULES:\n1. Use ONLY the information contained in the CONTEXT below. If any question or requirement cannot be answered from the context, respond exactly with the string: "I don't know".\n2. Focus ONLY on Indian law (Indian Contract Act, 1872 and related principles). Map clause risks precisely to Indian legal principles and explain why.\n3. Output exactly one strict JSON object and nothing else that conforms to the ContractAnalysisSchema.\n\nYou are a legal contract analysis engine focused on Indian law. Analyze the following contract text and return a STRICT JSON object that conforms to the schema described below. Do NOT include any text outside the JSON object.\n\nCONTEXT:\n${finalContext}\n\nOUTPUT: A single JSON object matching the ContractAnalysisSchema. Use arrays and numbers, do not include commentary.`;

  // Try Gemini first (if available), fallback to Ollama
  if (geminiClient && geminiClient.available) {
    try {
      const analysis = await geminiClient.analyzeContract(analysisPromptStrict, ContractAnalysisSchema);
      return { analysis, external_contexts: externalContexts || [], firecrawl_clauses: firecrawlContexts || [], tools_used: ['gemini'], analysisId: `analysis_text_${Date.now()}` };
    } catch (err) {
      console.warn('Gemini text analysis failed, falling back to local model (Ollama). Error:', err?.message || err);
    }
  }

  const systemPrompt = `You are a legal contract analysis expert. Output ONLY a valid JSON object that conforms to the following schema: final_score (0-100), summary (string), clauses (array of objects with clause_name, clause_text (optional), category (string), risk_level (low|medium|high|critical), risk_score (0-100), description (string), recommendations (string), india_laws (array optional), rewrite_suggestion (optional)). Include optional fields: predatory_index, trust_score, missing_clauses, negotiation_questions, recommendations.`;

  const modelResponseRaw = await ollamaClient.chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: analysisPromptStrict },
  ]);

  const modelResponse = typeof modelResponseRaw === 'string' ? modelResponseRaw : JSON.stringify(modelResponseRaw);
  const jsonMatch = modelResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to extract JSON from model response');
  const parsed = JSON.parse(jsonMatch[0]);
  ContractAnalysisSchema.parse(parsed);

  const analysisId = `analysis_text_${Date.now()}`;
  parsed.analysisId = analysisId;
  parsed.documentName = documentName;
  parsed.requiresExpertReview = true;

  const toolsUsed = [];
  if (externalContexts && externalContexts.length) toolsUsed.push('vector_db');
  if (Array.isArray(firecrawlContexts) && firecrawlContexts.length) toolsUsed.push('firecrawl');

  return {
    analysis: parsed,
    external_contexts: externalContexts || [],
    firecrawl_clauses: firecrawlContexts || [],
    tools_used: toolsUsed,
    analysisId
  };
}