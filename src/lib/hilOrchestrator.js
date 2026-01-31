import { connectMongoose } from './mongoose';
import Feedback from './models/Feedback';
import { storeFeedbackEmbedding } from './feedbackEmbeddings';
import { storeHILTrainingData } from './hilTraining';
import { ensureAdminSetup } from './db';
import { analyzeText } from './analyzer';

/**
 * HIL Orchestrator - Manages Human-in-the-Loop flow for ALL analyses
 * Every analysis must be reviewed by experts before reaching users
 */

/**
 * Submit analysis for expert review (mandatory HIL)
 * @param {Object} analysisData - The analysis result from AI
 * @param {string} userEmail - User who requested analysis
 * @param {string} type - Type of analysis (upload, chat, resume)
 * @param {Object} payload - Additional context data
 * @returns {Promise<Object>} HIL tracking data
 */
export async function submitForExpertReview(analysisData, userEmail, type, payload = {}) {
  try {
    await connectMongoose();
    
    // Get default expert/admin for review
    const defaultAdmin = (process.env.DEFAULT_ADMIN_EMAILS || 'ayusht5071@gmail.com').split(',')[0].trim().toLowerCase();
    await ensureAdminSetup(defaultAdmin);
    
    const analysisId = `hil_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create feedback entry in "pending_expert_review" status
    const feedback = new Feedback({
      analysisId,
      // Use standardized HIL type to match schema enum
      type: 'hil_analysis',
      documentName: payload.documentName || `${type}_analysis`,
      userEmail,
      expertEmail: defaultAdmin,
      originalAnalysis: analysisData,
      payload: {
        ...payload,
        analysis_type: type,
        timestamp: new Date().toISOString(),
        user_role: payload.user_role || 'unknown'
      },
      status: 'pending_expert_review', // New status for mandatory HIL
      metadata: {
        hil_mandatory: true,
        review_priority: 'high',
        re_analysis_count: 0,
        max_re_analysis: 3
      }
    });
    
    await feedback.save();
    
    // Store embedding for training pipeline
    try {
      await storeFeedbackEmbedding(feedback);
    } catch (e) {
      console.warn('Failed to store HIL feedback embedding:', e?.message || e);
    }
    
    return {
      hil_id: feedback._id,
      analysis_id: analysisId,
      status: 'pending_expert_review',
      message: 'Analysis submitted for expert review. Results will be available after approval.',
      estimated_review_time: '5-15 minutes'
    };
    
  } catch (error) {
    console.error('Failed to submit analysis for expert review:', error);
    throw error;
  }
}

/**
 * Expert approves/rejects analysis
 * @param {string} hilId - HIL feedback ID
 * @param {string} expertEmail - Expert reviewing
 * @param {boolean} approved - Whether analysis is approved
 * @param {Object} expertFeedback - Expert's feedback and corrections
 * @returns {Promise<Object>} Updated HIL status
 */
export async function expertReviewAnalysis(hilId, expertEmail, approved, expertFeedback = {}) {
  try {
    await connectMongoose();
    
    const feedback = await Feedback.findById(hilId);
    if (!feedback) {
      throw new Error('HIL analysis not found');
    }
    
      // Persist any expert-provided payloads (document text, role, vectorization choice)
    feedback.expertEmail = expertEmail;
    feedback.overallRating = expertFeedback.rating || (approved ? 4 : 2);
    feedback.accuracyScore = expertFeedback.accuracyScore || (approved ? 8 : 4);
    feedback.comments = expertFeedback.comments || '';
    feedback.suggestions = expertFeedback.suggestions || '';
    feedback.correctedClauses = expertFeedback.correctedClauses || null;
    feedback.additionalRisks = expertFeedback.additionalRisks || [];
    feedback.additionalBenefits = expertFeedback.additionalBenefits || [];

    feedback.payload = feedback.payload || {};
    if (expertFeedback.document_text) feedback.payload.document_text = expertFeedback.document_text;
    if (expertFeedback.user_role) feedback.payload.user_role = expertFeedback.user_role;
    if (typeof expertFeedback.apply_to_vector_store !== 'undefined') feedback.metadata = feedback.metadata || {}, feedback.metadata.apply_to_vector_store = expertFeedback.apply_to_vector_store;

    if (approved) {
      feedback.status = 'approved';

      // If expert provided an analysis preview on the client, persist it as the canonical analysis
      if (expertFeedback && expertFeedback.analysis_preview) {
        feedback.originalAnalysis = expertFeedback.analysis_preview;
      }

      // Store training data / vectorize approved analysis if requested
      try {
        // Determine the best document text to store as training data
        let docTextCandidate = '';

        // Priority: expert-provided explicit document_text in the review payload
        if (expertFeedback && expertFeedback.document_text) {
          docTextCandidate = String(expertFeedback.document_text);
        }

        // Then: any analysis preview provided by the expert (may include document_text)
        if (!docTextCandidate && expertFeedback && expertFeedback.analysis_preview) {
          const ap = expertFeedback.analysis_preview;
          if (typeof ap === 'string') docTextCandidate = ap;
          else if (ap.document_text) docTextCandidate = ap.document_text;
          else if (ap.raw_response) docTextCandidate = typeof ap.raw_response === 'string' ? ap.raw_response : JSON.stringify(ap.raw_response);
          else docTextCandidate = JSON.stringify(ap);
        }

        // Next: payload stored on the feedback
        if (!docTextCandidate && feedback.payload?.document_text) {
          docTextCandidate = feedback.payload.document_text;
        }

        // Next: originalAnalysis fields (if they contain a text or raw_response)
        if (!docTextCandidate && feedback.originalAnalysis) {
          const oa = feedback.originalAnalysis;
          if (typeof oa === 'string') docTextCandidate = oa;
          else if (oa.document_text) docTextCandidate = oa.document_text;
          else if (oa.payload && oa.payload.document_text) docTextCandidate = oa.payload.document_text;
          else if (oa.raw_response) docTextCandidate = typeof oa.raw_response === 'string' ? oa.raw_response : JSON.stringify(oa.raw_response);
          else docTextCandidate = JSON.stringify(oa);
        }

        // Trim to a reasonable max length for embedding
        if (docTextCandidate && docTextCandidate.length > 100000) {
          docTextCandidate = docTextCandidate.substring(0, 100000);
        }

        if (docTextCandidate && (feedback.metadata?.apply_to_vector_store !== false)) {
          const metrics = await storeHILTrainingData(feedback, docTextCandidate);
          feedback.metadata.hil_vectorized = true;
          feedback.metadata.last_training_metrics = metrics;
        }

        // Always try to store a feedback-level embedding for search/traceability
        try {
          await storeFeedbackEmbedding(feedback);
        } catch (e) {
          console.warn('Failed to store feedback embedding after approval:', e?.message || e);
        }
      } catch (e) {
        console.warn('Failed to store HIL training data:', e?.message || e);
      }

    } else {
      // Mark for revision and optionally trigger re-analysis immediately if requested
      feedback.status = 'needs_revision';
      feedback.metadata.re_analysis_count = (feedback.metadata?.re_analysis_count || 0) + 1;
    }

    feedback.metadata.last_review_date = new Date().toISOString();
    feedback.metadata.expert_review_time = new Date() - new Date(feedback.createdAt);

    await feedback.save();

    // If expert asked for reanalysis (or rejected and requested rethinking), trigger it
    if (!approved && expertFeedback.request_reanalysis) {
      try {
        const reanalysis = await reAnalyzeWithFeedback(hilId, async (expertContext) => {
          const docText = feedback.payload?.document_text || (feedback.originalAnalysis ? JSON.stringify(feedback.originalAnalysis) : '');
          return await analyzeText((docText ? docText + '\n\n' : '') + expertContext, feedback.documentName, feedback.payload?.user_role);
        });

        return {
          hil_id: feedback._id,
          status: reanalysis.status || feedback.status,
          re_analysis_count: feedback.metadata?.re_analysis_count || 0,
          reanalysis_result: reanalysis.re_analysis_result || null
        };
      } catch (e) {
        console.warn('Re-analysis trigger failed:', e?.message || e);
        // fall through to return standard result
      }
    }

    return {
      hil_id: feedback._id,
      status: feedback.status,
      approved,
      re_analysis_count: feedback.metadata?.re_analysis_count || 0,
      expert_feedback: approved ? null : expertFeedback,
      hil_vectorized: feedback.metadata?.hil_vectorized || false,
      last_training_metrics: feedback.metadata?.last_training_metrics || null
    };
    
  } catch (error) {
    console.error('Failed to process expert review:', error);
    throw error;
  }
}

/**
 * Re-analyze document with expert feedback
 * @param {string} hilId - HIL feedback ID
 * @param {Function} analysisFunction - Function to re-run analysis
 * @returns {Promise<Object>} Re-analysis result
 */
export async function reAnalyzeWithFeedback(hilId, analysisFunction) {
  try {
    await connectMongoose();
    
    const feedback = await Feedback.findById(hilId);
    if (!feedback) {
      throw new Error('HIL analysis not found');
    }
    
    const reAnalysisCount = feedback.metadata?.re_analysis_count || 0;
    const maxReAnalysis = feedback.metadata?.max_re_analysis || 3;
    
    if (reAnalysisCount >= maxReAnalysis) {
      throw new Error('Maximum re-analysis attempts reached');
    }
    
    // Build enhanced prompt with expert feedback
    const expertContext = buildExpertFeedbackContext(feedback);
    
    // Re-run analysis with expert feedback context
    const reAnalysisResult = await analysisFunction(expertContext);
    
    // Update feedback with re-analysis
    feedback.originalAnalysis = reAnalysisResult;
    feedback.status = 'pending_expert_review';
    feedback.metadata.re_analysis_count = reAnalysisCount + 1;
    feedback.metadata.last_re_analysis_date = new Date().toISOString();
    
    await feedback.save();
    
    return {
      hil_id: feedback._id,
      re_analysis_result: reAnalysisResult,
      re_analysis_count: feedback.metadata.re_analysis_count,
      status: 'pending_expert_review'
    };
    
  } catch (error) {
    console.error('Failed to re-analyze with feedback:', error);
    throw error;
  }
}

/**
 * Check HIL status for user
 * @param {string} analysisId - Analysis ID
 * @param {string} userEmail - User email
 * @returns {Promise<Object>} HIL status and result if approved
 */
export async function checkHILStatus(analysisId, userEmail) {
  try {
    await connectMongoose();
    
    const feedback = await Feedback.findOne({ 
      analysisId, 
      userEmail 
    }).sort({ createdAt: -1 });
    
    if (!feedback) {
      return { status: 'not_found' };
    }
    
    const result = {
      hil_id: feedback._id,
      status: feedback.status,
      created_at: feedback.createdAt,
      updated_at: feedback.updatedAt
    };
    
    if (feedback.status === 'approved') {
      result.analysis = feedback.originalAnalysis;
      result.expert_notes = feedback.comments;
    } else if (feedback.status === 'needs_revision') {
      result.re_analysis_count = feedback.metadata?.re_analysis_count || 0;
      result.max_attempts = feedback.metadata?.max_re_analysis || 3;
    }
    
    return result;
    
  } catch (error) {
    console.error('Failed to check HIL status:', error);
    throw error;
  }
}

/**
 * Get pending expert reviews
 * @param {string} expertEmail - Expert email
 * @returns {Promise<Array>} Pending reviews
 */
export async function getPendingReviews(expertEmail) {
  try {
    await connectMongoose();
    
    const pendingReviews = await Feedback.find({
      $or: [
        { expertEmail, status: 'pending_expert_review' },
        { status: 'pending_expert_review' } // All pending if expert
      ]
    }).sort({ createdAt: 1 }).limit(50);
    
    return pendingReviews.map(review => ({
      hil_id: review._id,
      analysis_id: review.analysisId,
      type: review.type,
      document_name: review.documentName,
      user_email: review.userEmail,
      created_at: review.createdAt,
      re_analysis_count: review.metadata?.re_analysis_count || 0,
      priority: review.metadata?.review_priority || 'medium',
      analysis: review.originalAnalysis
    }));
    
  } catch (error) {
    console.error('Failed to get pending reviews:', error);
    throw error;
  }
}

/**
 * Build expert feedback context for re-analysis
 */
function buildExpertFeedbackContext(feedback) {
  let context = '\n\nEXPERT FEEDBACK FOR IMPROVEMENT:\n';
  
  if (feedback.comments) {
    context += `Expert Comments: ${feedback.comments}\n`;
  }
  
  if (feedback.suggestions) {
    context += `Expert Suggestions: ${feedback.suggestions}\n`;
  }
  
  if (feedback.additionalRisks?.length) {
    context += `Additional Risks to Consider: ${feedback.additionalRisks.join(', ')}\n`;
  }
  
  if (feedback.additionalBenefits?.length) {
    context += `Additional Benefits to Highlight: ${feedback.additionalBenefits.join(', ')}\n`;
  }
  
  if (feedback.correctedClauses) {
    context += `Corrected Clause Analysis: ${JSON.stringify(feedback.correctedClauses, null, 2)}\n`;
  }
  
  context += `\nIMPORTANT: Address the above expert feedback in your analysis. `;
  context += `Previous analysis was rejected ${feedback.metadata?.re_analysis_count || 0} time(s). `;
  context += `Focus on accuracy and completeness based on expert guidance.\n`;
  
  return context;
}

/**
 * Auto-assign expert for review based on document type and availability
 * @param {string} analysisType - Type of analysis
 * @param {Object} payload - Analysis context
 * @returns {Promise<string>} Expert email
 */
export async function assignExpert(analysisType, payload = {}) {
  try {
    await connectMongoose();
    
    // For now, use default admin but this could be enhanced with:
    // - Expert specialization matching
    // - Load balancing
    // - Availability checking
    const defaultAdmin = (process.env.DEFAULT_ADMIN_EMAILS || 'ayusht5071@gmail.com').split(',')[0].trim().toLowerCase();
    
    // Future: Add expert specialization logic
    // const specialists = await getSpecialistExperts(analysisType, payload.user_role);
    // return selectBestAvailableExpert(specialists);
    
    return defaultAdmin;
    
  } catch (error) {
    console.error('Failed to assign expert:', error);
    return (process.env.DEFAULT_ADMIN_EMAILS || 'ayusht5071@gmail.com').split(',')[0].trim().toLowerCase();
  }
}