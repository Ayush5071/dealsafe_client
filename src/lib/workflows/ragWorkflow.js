import { ollamaClient } from '../llm';
import enhancedVectorDb from '../enhancedVectorDb';
import { generateEmbeddings } from '../embeddings';

/**
 * LangGraph RAG Workflow for Contract Analysis
 * Multi-agent pipeline with retrieval, context building, and analysis
 */

// Workflow State
class RAGWorkflowState {
    constructor(query, contractText, userId) {
        this.query = query;
        this.contractText = contractText;
        this.userId = userId;
        this.retrievedChunks = [];
        this.context = '';
        this.analysis = null;
        this.confidence = 0;
        this.needsReview = false;
        this.status = 'pending';
    }
}

/**
 * Agent 1: Retrieval Agent
 * Retrieves relevant chunks from vector store
 */
class RetrievalAgent {
    async execute(state) {
        console.log('[RetrievalAgent] Retrieving relevant chunks...');

        try {
            // Generate embedding for query
            const queryEmbedding = await generateEmbeddings([state.query]);

            // Search vector store with preference for admin-reviewed content
            const results = await enhancedVectorDb.search(
                queryEmbedding[0],
                10,
                {
                    minQualityScore: 3, // Prefer quality content
                    adminReviewed: undefined // Include both reviewed and unreviewed
                }
            );

            state.retrievedChunks = results;
            console.log(`[RetrievalAgent] Retrieved ${results.length} chunks`);

            return state;
        } catch (error) {
            console.error('[RetrievalAgent] Error:', error);
            state.status = 'error';
            return state;
        }
    }
}

/**
 * Agent 2: Context Builder
 * Builds enhanced context from retrieved chunks and admin feedback
 */
class ContextBuilderAgent {
    async execute(state) {
        console.log('[ContextBuilderAgent] Building context...');

        // Separate admin-reviewed and regular chunks
        const adminReviewed = state.retrievedChunks.filter(c => c.metadata.adminReviewed);
        const regular = state.retrievedChunks.filter(c => !c.metadata.adminReviewed);

        let context = 'RELEVANT CONTRACT EXAMPLES:\n\n';

        // Prioritize admin-reviewed content
        if (adminReviewed.length > 0) {
            context += '=== VERIFIED EXAMPLES (Admin Approved) ===\n';
            adminReviewed.forEach((chunk, idx) => {
                context += `\nExample ${idx + 1} (Quality: ${chunk.metadata.qualityScore}/5):\n`;
                context += chunk.text + '\n';

                if (chunk.adminFeedback) {
                    context += `Admin Note: ${chunk.adminFeedback.note || 'Verified as accurate'}\n`;
                }
            });
            context += '\n';
        }

        // Add regular examples
        if (regular.length > 0) {
            context += '=== ADDITIONAL EXAMPLES ===\n';
            regular.slice(0, 5).forEach((chunk, idx) => {
                context += `\nExample ${idx + 1}:\n${chunk.text}\n`;
            });
        }

        state.context = context;
        console.log('[ContextBuilderAgent] Context built with', adminReviewed.length, 'verified examples');

        return state;
    }
}

/**
 * Agent 3: Analysis Agent
 * Generates analysis using RAG context and Qwen
 */
class AnalysisAgent {
    async execute(state) {
        console.log('[AnalysisAgent] Generating analysis...');

        const prompt = `You are an expert contract analyzer. Use the provided examples to analyze this contract.

${state.context}

CONTRACT TO ANALYZE:
${state.contractText.substring(0, 3000)}

QUESTION: ${state.query}

Provide a detailed analysis based on the examples above. If the verified examples show similar patterns, mention them. Return a JSON object:
{
  "analysis": "Detailed analysis",
  "keyFindings": ["finding 1", "finding 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "confidence": 0.0-1.0
}`;

        try {
            const response = await ollamaClient.chat(
                [{ role: 'user', content: prompt }],
                'You are an expert contract analyst using verified examples to provide accurate analysis.'
            );

            // Parse JSON response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                state.analysis = result;
                state.confidence = result.confidence || 0.7;
            } else {
                state.analysis = { analysis: response, confidence: 0.5 };
                state.confidence = 0.5;
            }

            console.log('[AnalysisAgent] Analysis complete. Confidence:', state.confidence);
            return state;

        } catch (error) {
            console.error('[AnalysisAgent] Error:', error);
            state.status = 'error';
            return state;
        }
    }
}

/**
 * Agent 4: Quality Checker
 * Validates response quality and flags for admin review
 */
class QualityCheckerAgent {
    async execute(state) {
        console.log('[QualityCheckerAgent] Checking quality...');

        const CONFIDENCE_THRESHOLD = 0.6;

        // Flag for review if confidence is low
        if (state.confidence < CONFIDENCE_THRESHOLD) {
            state.needsReview = true;
            console.log('[QualityCheckerAgent] Low confidence - flagged for admin review');
        }

        // Flag if no admin-reviewed examples were used
        const hasVerifiedExamples = state.retrievedChunks.some(c => c.metadata.adminReviewed);
        if (!hasVerifiedExamples) {
            state.needsReview = true;
            console.log('[QualityCheckerAgent] No verified examples - flagged for admin review');
        }

        state.status = 'complete';
        return state;
    }
}

/**
 * LangGraph RAG Workflow Orchestrator
 */
export class RAGWorkflow {
    constructor() {
        this.retrievalAgent = new RetrievalAgent();
        this.contextBuilder = new ContextBuilderAgent();
        this.analysisAgent = new AnalysisAgent();
        this.qualityChecker = new QualityCheckerAgent();
    }

    async execute(query, contractText, userId = null) {
        console.log('[RAGWorkflow] Starting workflow...');

        // Initialize state
        let state = new RAGWorkflowState(query, contractText, userId);

        try {
            // Step 1: Retrieve relevant chunks
            state = await this.retrievalAgent.execute(state);
            if (state.status === 'error') return state;

            // Step 2: Build context
            state = await this.contextBuilder.execute(state);

            // Step 3: Generate analysis
            state = await this.analysisAgent.execute(state);
            if (state.status === 'error') return state;

            // Step 4: Check quality
            state = await this.qualityChecker.execute(state);

            console.log('[RAGWorkflow] Workflow complete');
            return state;

        } catch (error) {
            console.error('[RAGWorkflow] Workflow error:', error);
            state.status = 'error';
            return state;
        }
    }
}

// Export singleton
export const ragWorkflow = new RAGWorkflow();
export default ragWorkflow;
