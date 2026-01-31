import { NextResponse } from 'next/server';
import { analyzeFile } from '@/lib/analyzer';
import { connectMongoose } from '@/lib/mongoose';
import Feedback from '@/lib/models/Feedback';
import { ensureAdminSetup } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from "@/lib/authOptions";
import { submitForExpertReview } from '@/lib/hilOrchestrator';

export async function POST(request) {
  try {
    const body = await request.json();
    const { filename, language = 'en' } = body;

    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    console.log('Running analysis for:', filename, 'in language:', language);

    // 1. Run Core Analysis
    const { analysis, external_contexts, analysisId } = await analyzeFile(filename, language);

    // 2. Translate if needed
    let translatedAnalysis = analysis;
    if (language !== 'en') {
      try {
        console.log(`Translating analysis to ${language}...`);
        const freeTranslate = await import('@/lib/freeTranslate');
        translatedAnalysis = await freeTranslate.translateAnalysis(analysis, language);
        console.log(`Analysis translated to ${language}`);
      } catch (err) {
        console.warn('Translation failed, using original analysis:', err);
        translatedAnalysis = analysis;
      }
    }

    // 3. Get User Session (Correctly)
    let userEmail = 'system@local';
    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.email) {
        userEmail = session.user.email;
      }
    } catch (e) {
      console.warn('Failed to get session in analyze route:', e);
    }

    // 4. Save Analysis Result to Database (Standard Persistence)
    // This runs REGARDLESS of HIL requests to ensure history is kept.
    try {
      await connectMongoose();
      const defaultAdmin = (process.env.DEFAULT_ADMIN_EMAILS || 'ayusht5071@gmail.com').split(',')[0].trim().toLowerCase();
      // Only ensure admin if userEmail is valid (avoid creating junk users)
      if (userEmail !== 'system@local') {
        // We don't strictly need to run ensureAdminSetup for the current user here,
        // but we might want to ensure the expert exists.
        // await ensureAdminSetup(defaultAdmin); 
      }

      // Check if we already have a record (optional, but good for idempotency)
      const existing = await Feedback.findOne({ analysisId });

      let feedbackId = existing?._id;

      if (!existing) {
        const feedbackRecord = new Feedback({
          analysisId: analysisId || `analysis_${Date.now()}`,
          type: 'analysis',
          documentName: filename,
          userEmail: userEmail,
          expertEmail: defaultAdmin,
          expertName: '',
          originalAnalysis: translatedAnalysis,
          status: 'pending'
        });

        await feedbackRecord.save();
        feedbackId = feedbackRecord._id;
        console.log('Analysis saved to DB:', feedbackId);

        // Queue embedding generation in background
        const { storeFeedbackEmbedding } = await import('@/lib/feedbackEmbeddings');
        storeFeedbackEmbedding(feedbackRecord).catch((e) => console.warn('storeFeedbackEmbedding error:', e));
      } else {
        console.log('Analysis already exists in DB:', feedbackId);
      }

      // 5. Handle HIL (Optional)
      const useHIL = (body && body.useHIL === true) || (request.headers?.get('x-use-hil') === 'true');
      if (useHIL) {
        try {
          const hilResult = await submitForExpertReview(translatedAnalysis, userEmail, 'upload', {
            documentName: filename,
            document_text: null,
            pages: null,
            chunks_processed: null,
            user_role: 'unknown'
          });

          return NextResponse.json({
            success: true,
            filename,
            external_contexts: external_contexts || [],
            hil_mandatory: true,
            hil_id: hilResult.hil_id,
            analysis_id: hilResult.analysis_id,
            status: hilResult.status,
            message: hilResult.message,
            estimated_review_time: hilResult.estimated_review_time
          });
        } catch (hilErr) {
          console.error('HIL submission failed:', hilErr);
          // Fallback to returning standard result if HIL fails
        }
      }

      // Return standard success response
      return NextResponse.json({
        success: true,
        filename,
        analysis: translatedAnalysis,
        external_contexts: external_contexts || [],
        feedback_id: feedbackId
      });

    } catch (saveError) {
      console.error('Failed to save analysis to DB:', saveError);
      // Still return success to frontend so UI shows analysis, even if save failed
      return NextResponse.json({
        success: true,
        filename,
        analysis: translatedAnalysis,
        external_contexts: external_contexts || [],
        warning: 'Failed to save to history'
      });
    }

  } catch (error) {
    console.error('Error analyzing contract:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid analysis format received from AI' }, { status: 500 });
    }
    return NextResponse.json({ error: error.message || 'Failed to analyze contract' }, { status: 500 });
  }
}
