import { ollamaClient } from '../llm';
import { crawlerWorkflow } from '../webCrawler';
import enhancedVectorDb from '../enhancedVectorDb';
import { generateEmbeddings } from '../embeddings';

/**
 * LangGraph Upload Analysis Workflow
 * Multi-agent pipeline for contract upload and analysis
 */

// Workflow State
class UploadWorkflowState {
    constructor(contractText, filename, userId) {
        this.contractText = contractText;
        this.filename = filename;
        this.userId = userId;
        this.chunks = [];
        this.embeddings = [];
        this.webContext = [];
        this.analysis = null;
        this.clauses = [];
        this.confidence = {};
        this.status = 'pending';
    }
}

/**
 * Agent 1: Text Chunker
 * Splits contract into meaningful chunks
 */
class TextChunkerAgent {
    async execute(state) {
        console.log('[TextChunkerAgent] Chunking contract text...');

        const CHUNK_SIZE = 500;
        const OVERLAP = 100;
        const text = state.contractText;
        const chunks = [];

        for (let i = 0; i < text.length; i += CHUNK_SIZE - OVERLAP) {
            const chunk = text.slice(i, i + CHUNK_SIZE);
            if (chunk.trim()) {
                chunks.push({
                    text: chunk,
                    index: chunks.length,
                    source: state.filename,
                    sourceType: 'pdf'
                });
            }
        }

        state.chunks = chunks;
        console.log(`[TextChunkerAgent] Created ${chunks.length} chunks`);
        return state;
    }
}

/**
 * Agent 2: Embedding Generator
 * Generates embeddings for chunks
 */
class EmbeddingAgent {
    async execute(state) {
        console.log('[EmbeddingAgent] Generating embeddings...');

        try {
            const texts = state.chunks.map(c => c.text);
            const embeddings = await generateEmbeddings(texts);

            state.embeddings = embeddings;
            console.log(`[EmbeddingAgent] Generated ${embeddings.length} embeddings`);
            return state;
        } catch (error) {
            console.error('[EmbeddingAgent] Error:', error);
            state.status = 'error';
            return state;
        }
    }
}

/**
 * Agent 3: Web Scraping Agent
 * Fetches relevant web context
 */
class WebScrapingAgent {
    async execute(state) {
        console.log('[WebScrapingAgent] Fetching web context...');

        try {
            // Extract key terms for search
            const searchQuery = `contract clauses ${state.filename.split('.')[0]}`;

            // crawlerWorkflow.execute returns array of relevant clauses
            const webResults = await crawlerWorkflow.execute(searchQuery);

            if (webResults && webResults.length > 0) {
                state.webContext = webResults.map(result => ({
                    text: result.clauses ? result.clauses.join(' ') : result.summary,
                    source: result.source,
                    sourceType: 'web',
                    relevance: result.confidence || 0.7
                }));
                console.log(`[WebScrapingAgent] Found ${state.webContext.length} web clauses`);
            } else {
                console.log('[WebScrapingAgent] No web context found');
            }

            return state;
        } catch (error) {
            console.error('[WebScrapingAgent] Error:', error);
            // Continue without web context
            return state;
        }
    }
}

/**
 * Agent 4: Vector Storage Agent
 * Stores embeddings in vector DB
 */
class VectorStorageAgent {
    async execute(state) {
        console.log('[VectorStorageAgent] Storing vectors...');

        try {
            const vectors = state.chunks.map((chunk, idx) => ({
                text: chunk.text,
                embedding: state.embeddings[idx],
                metadata: {
                    source: state.filename,
                    chunkId: idx,
                    sourceType: 'pdf'
                }
            }));

            await enhancedVectorDb.addVectors(vectors, state.userId);
            console.log('[VectorStorageAgent] Vectors stored successfully');
            return state;
        } catch (error) {
            console.error('[VectorStorageAgent] Error:', error);
            state.status = 'error';
            return state;
        }
    }
}

/**
 * Agent 5: Clause Extraction Agent
 * Extracts and categorizes clauses
 */
class ClauseExtractionAgent {
    async execute(state) {
        console.log('[ClauseExtractionAgent] Extracting clauses...');

        const prompt = `Extract all important clauses from this contract. For each clause, provide:
1. Clause name/title
2. Clause text
3. Category (payment, termination, IP, liability, etc.)
4. Risk level (low/medium/high)

CONTRACT:
${state.contractText.substring(0, 3000)}

Return ONLY a JSON array:
[
  {
    "name": "clause name",
    "text": "clause text",
    "category": "category",
    "risk": "low/medium/high"
  }
]`;

        try {
            const response = await ollamaClient.chat(
                [{ role: 'user', content: prompt }],
                'You are a contract clause extraction expert.'
            );

            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const clauses = JSON.parse(jsonMatch[0]);

                // Add confidence scores
                state.clauses = clauses.map(clause => ({
                    ...clause,
                    confidence: this._calculateConfidence(clause, state)
                }));

                console.log(`[ClauseExtractionAgent] Extracted ${state.clauses.length} clauses`);
            }

            return state;
        } catch (error) {
            console.error('[ClauseExtractionAgent] Error:', error);
            state.clauses = [];
            return state;
        }
    }

    _calculateConfidence(clause, state) {
        // Check if clause text appears in original PDF
        const inPDF = state.contractText.includes(clause.text.substring(0, 50));

        if (inPDF) {
            return 100; // 100% confidence if directly from PDF
        }

        // Check if similar to web context
        const similarToWeb = state.webContext.some(web =>
            this._similarity(clause.text, web.text) > 0.7
        );

        if (similarToWeb) {
            return 75; // 75% if supported by web sources
        }

        return 60; // 60% base confidence for AI-extracted clauses
    }

    _similarity(text1, text2) {
        const words1 = text1.toLowerCase().split(/\s+/);
        const words2 = text2.toLowerCase().split(/\s+/);
        const common = words1.filter(w => words2.includes(w));
        return common.length / Math.max(words1.length, words2.length);
    }
}

/**
 * Agent 6: Analysis Agent
 * Generates comprehensive analysis
 */
class AnalysisAgent {
    async execute(state) {
        console.log('[AnalysisAgent] Generating analysis...');

        const webContextText = state.webContext.length > 0
            ? `\n\nWEB CONTEXT:\n${state.webContext.map(w => w.text).join('\n\n')}`
            : '';

        const prompt = `Analyze this contract comprehensively.

CONTRACT:
${state.contractText.substring(0, 3000)}
${webContextText}

EXTRACTED CLAUSES:
${JSON.stringify(state.clauses.slice(0, 5), null, 2)}

Provide:
1. Overall summary
2. Key risks
3. Recommendations
4. Missing important clauses

Return JSON:
{
  "summary": "brief summary",
  "risks": ["risk 1", "risk 2"],
  "recommendations": ["rec 1", "rec 2"],
  "missingClauses": ["clause 1", "clause 2"]
}`;

        try {
            const response = await ollamaClient.chat(
                [{ role: 'user', content: prompt }],
                'You are an expert contract analyst.'
            );

            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                state.analysis = JSON.parse(jsonMatch[0]);
            } else {
                state.analysis = { summary: response };
            }

            state.status = 'complete';
            console.log('[AnalysisAgent] Analysis complete');
            return state;
        } catch (error) {
            console.error('[AnalysisAgent] Error:', error);
            state.status = 'error';
            return state;
        }
    }
}

/**
 * Upload Analysis Workflow Orchestrator
 */
export class UploadWorkflow {
    constructor() {
        this.chunker = new TextChunkerAgent();
        this.embedder = new EmbeddingAgent();
        this.webScraper = new WebScrapingAgent();
        this.vectorStorage = new VectorStorageAgent();
        this.clauseExtractor = new ClauseExtractionAgent();
        this.analyzer = new AnalysisAgent();
    }

    async execute(contractText, filename, userId = null) {
        console.log('[UploadWorkflow] Starting workflow...');

        let state = new UploadWorkflowState(contractText, filename, userId);

        try {
            // Step 1: Chunk text
            state = await this.chunker.execute(state);
            if (state.status === 'error') return state;

            // Step 2: Generate embeddings
            state = await this.embedder.execute(state);
            if (state.status === 'error') return state;

            // Step 3: Fetch web context (parallel with storage)
            const webPromise = this.webScraper.execute(state);

            // Step 4: Store vectors
            state = await this.vectorStorage.execute(state);
            if (state.status === 'error') return state;

            // Wait for web scraping
            state = await webPromise;

            // Step 5: Extract clauses with confidence
            state = await this.clauseExtractor.execute(state);

            // Step 6: Generate analysis
            state = await this.analyzer.execute(state);

            console.log('[UploadWorkflow] Workflow complete');
            return state;

        } catch (error) {
            console.error('[UploadWorkflow] Workflow error:', error);
            state.status = 'error';
            return state;
        }
    }
}

export const uploadWorkflow = new UploadWorkflow();
export default uploadWorkflow;
