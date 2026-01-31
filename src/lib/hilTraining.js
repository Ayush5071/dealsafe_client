import { generateEmbedding } from './embeddings';
import vectorDb from './vectorDb';

/**
 * HIL (Human-in-the-Loop) Training Utilities
 * Specialized functions for training and improving the AI system based on expert feedback
 */

/**
 * Store HIL training data with enhanced embeddings
 * @param {Object} feedback - Feedback object with expert corrections
 * @param {string} documentText - Original document text
 * @returns {Promise<Object>} Training metrics
 */
export async function storeHILTrainingData(feedback, documentText) {
  try {
    const metrics = {
      vectors_added: 0,
      training_records: 0,
      confidence_updates: 0
    };

    // Create enhanced embedding that includes expert corrections
    const enhancedText = buildEnhancedTrainingText(documentText, feedback);
    const embedding = await generateEmbedding(enhancedText);

    // Store with HIL-specific metadata
    await vectorDb.add([{
      text: enhancedText,
      embedding,
      source: `HIL_${feedback.type}_${feedback.analysisId}`,
      metadata: {
        document_name: feedback.documentName,
        expert_email: feedback.expertEmail,
        user_role: feedback.payload?.user_role || 'unknown',
        analysis_type: feedback.payload?.analysis_type || 'contract',
        expert_rating: feedback.overallRating,
        accuracy_score: feedback.accuracyScore,
        training_priority: feedback.metadata?.training_priority || 'medium',
        confidence_score: feedback.metadata?.confidence_score || 0,
        timestamp: new Date().toISOString(),
        hil_enhanced: true
      }
    }]);

    metrics.vectors_added = 1;
    metrics.training_records = 1;

    // Store corrections as separate training examples
    if (feedback.correctedClauses || feedback.additionalRisks?.length || feedback.additionalBenefits?.length) {
      const correctionText = buildCorrectionText(documentText, feedback);
      const correctionEmbedding = await generateEmbedding(correctionText);

      await vectorDb.add([{
        text: correctionText,
        embedding: correctionEmbedding,
        source: `HIL_CORRECTION_${feedback.analysisId}`,
        metadata: {
          document_name: feedback.documentName,
          expert_email: feedback.expertEmail,
          correction_type: 'expert_feedback',
          training_priority: 'high',
          timestamp: new Date().toISOString(),
          hil_correction: true
        }
      }]);

      metrics.vectors_added += 1;
      metrics.confidence_updates = 1;
    }

    return metrics;
  } catch (error) {
    console.error('Failed to store HIL training data:', error);
    throw error;
  }
}

/**
 * Build enhanced text that combines original document with expert insights
 */
function buildEnhancedTrainingText(documentText, feedback) {
  let enhancedText = documentText;

  // Add expert rating context
  if (feedback.overallRating) {
    enhancedText += `\n\nEXPERT_ASSESSMENT: Overall rating ${feedback.overallRating}/5`;
  }

  if (feedback.accuracyScore) {
    enhancedText += `\n\nACCURACY_SCORE: ${feedback.accuracyScore}/10`;
  }

  // Add expert comments as training signal
  if (feedback.comments) {
    enhancedText += `\n\nEXPERT_INSIGHTS: ${feedback.comments}`;
  }

  if (feedback.suggestions) {
    enhancedText += `\n\nEXPERT_SUGGESTIONS: ${feedback.suggestions}`;
  }

  // Add role-specific context
  if (feedback.payload?.user_role) {
    enhancedText += `\n\nROLE_CONTEXT: Analysis for ${feedback.payload.user_role}`;
  }

  return enhancedText;
}

/**
 * Build correction-specific text for training on expert corrections
 */
function buildCorrectionText(documentText, feedback) {
  let correctionText = `EXPERT_CORRECTIONS for document: ${feedback.documentName}\n\n`;
  
  correctionText += `ORIGINAL_ANALYSIS:\n${JSON.stringify(feedback.originalAnalysis, null, 2)}\n\n`;

  if (feedback.correctedClauses) {
    correctionText += `CORRECTED_CLAUSES:\n${JSON.stringify(feedback.correctedClauses, null, 2)}\n\n`;
  }

  if (feedback.additionalRisks?.length) {
    correctionText += `ADDITIONAL_RISKS:\n${feedback.additionalRisks.join('\n')}\n\n`;
  }

  if (feedback.additionalBenefits?.length) {
    correctionText += `ADDITIONAL_BENEFITS:\n${feedback.additionalBenefits.join('\n')}\n\n`;
  }

  if (feedback.comments) {
    correctionText += `EXPERT_FEEDBACK:\n${feedback.comments}\n\n`;
  }

  // Include snippet of original document for context
  const docSnippet = documentText.substring(0, 500) + (documentText.length > 500 ? '...' : '');
  correctionText += `DOCUMENT_CONTEXT:\n${docSnippet}`;

  return correctionText;
}

/**
 * Retrieve HIL training examples for similar documents
 * @param {string} text - Document text to find similar training examples for
 * @param {number} limit - Number of examples to return
 * @returns {Promise<Array>} Similar HIL training examples
 */
export async function getHILTrainingExamples(text, limit = 5) {
  try {
    const embedding = await generateEmbedding(text);
    const results = await vectorDb.search(embedding, limit * 2); // Get more to filter
    
    // Filter for HIL-enhanced examples
    const hilExamples = results.filter(r => 
      r.source?.startsWith('HIL_') && 
      r.metadata?.hil_enhanced === true
    ).slice(0, limit);

    return hilExamples.map(example => ({
      text: example.text,
      source: example.source,
      score: example.score,
      metadata: example.metadata,
      training_insights: {
        expert_rating: example.metadata?.expert_rating,
        accuracy_score: example.metadata?.accuracy_score,
        user_role: example.metadata?.user_role,
        analysis_type: example.metadata?.analysis_type
      }
    }));
  } catch (error) {
    console.error('Failed to get HIL training examples:', error);
    return [];
  }
}

/**
 * Analyze training data quality and suggest improvements
 * @param {Object} feedback - Feedback object
 * @returns {Object} Training quality assessment
 */
export function assessTrainingQuality(feedback) {
  const assessment = {
    quality_score: 0,
    completeness: 0,
    training_value: 'low',
    improvement_suggestions: []
  };

  let qualityFactors = 0;
  let totalFactors = 0;

  // Check completeness of expert feedback
  totalFactors += 5;
  if (feedback.overallRating) qualityFactors += 1;
  if (feedback.accuracyScore) qualityFactors += 1;
  if (feedback.comments?.length > 20) qualityFactors += 1;
  if (feedback.suggestions?.length > 20) qualityFactors += 1;
  if (feedback.correctedClauses || feedback.additionalRisks?.length || feedback.additionalBenefits?.length) qualityFactors += 1;

  assessment.completeness = (qualityFactors / totalFactors) * 100;

  // Assess training value
  if (feedback.accuracyScore && feedback.accuracyScore <= 6) {
    assessment.training_value = 'high';
    assessment.improvement_suggestions.push('Low accuracy score provides valuable correction data');
  } else if (feedback.accuracyScore && feedback.accuracyScore >= 8) {
    assessment.training_value = 'medium';
    assessment.improvement_suggestions.push('High accuracy score validates current approach');
  }

  if (feedback.correctedClauses) {
    assessment.training_value = 'high';
    assessment.improvement_suggestions.push('Clause corrections provide specific training targets');
  }

  if (!feedback.comments || feedback.comments.length < 10) {
    assessment.improvement_suggestions.push('More detailed comments would improve training value');
  }

  assessment.quality_score = assessment.completeness;

  return assessment;
}

/**
 * Generate HIL-aware prompts that incorporate similar training examples
 * @param {string} text - Document text
 * @param {string} userRole - User's role
 * @returns {Promise<Object>} Enhanced prompt with HIL context
 */
export async function generateHILAwarePrompt(text, userRole) {
  try {
    const hilExamples = await getHILTrainingExamples(text, 3);
    
    let hilContext = '';
    if (hilExamples.length > 0) {
      hilContext = '\n\nHUMAN-IN-THE-LOOP TRAINING CONTEXT:\n';
      hilContext += 'Based on expert feedback from similar documents:\n\n';
      
      hilExamples.forEach((example, index) => {
        hilContext += `Example ${index + 1} (Similarity: ${(example.score * 100).toFixed(1)}%):\n`;
        hilContext += `Expert Rating: ${example.training_insights.expert_rating || 'N/A'}/5\n`;
        hilContext += `Accuracy Score: ${example.training_insights.accuracy_score || 'N/A'}/10\n`;
        if (example.training_insights.user_role === userRole) {
          hilContext += `Role Match: ✓ (${userRole})\n`;
        }
        hilContext += `Key Insights: ${example.text.split('EXPERT_INSIGHTS:')[1]?.split('\n')[0] || 'None'}\n\n`;
      });
      
      hilContext += 'Use this expert feedback to inform your analysis and provide more accurate assessments.\n';
    }
    
    return {
      hil_context: hilContext,
      training_examples_count: hilExamples.length,
      has_role_match: hilExamples.some(e => e.training_insights.user_role === userRole)
    };
  } catch (error) {
    console.error('Failed to generate HIL-aware prompt:', error);
    return { hil_context: '', training_examples_count: 0, has_role_match: false };
  }
}