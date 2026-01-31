import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { extractTextFromPDF } from '@/lib/pdfParser';
import { ollamaClient, geminiClient } from '@/lib/llm';
import { ContractAnalysisSchema } from '@/lib/schemas';
import { getToken } from 'next-auth/jwt';
import { getUserRoleByEmail, getUserProfile, ensureAdminSetup } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { connectMongoose } from '@/lib/mongoose';
import Feedback from '@/lib/models/Feedback';
import { storeFeedbackEmbedding } from '@/lib/feedbackEmbeddings';
import { generateHILAwarePrompt, assessTrainingQuality } from '@/lib/hilTraining';

export async function POST(req) {
    try {
        // Authenticate: require logged-in expert user
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
        if (!token?.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

        const userRole = await getUserRoleByEmail(token.email);
        if (!userRole) return NextResponse.json({ error: 'User role not found' }, { status: 403 });

        const userProfile = await getUserProfile(token.email);
        if (!userProfile?.expert && !userProfile?.isExpert) {
            return NextResponse.json({ error: 'HIL Analyzer is only available to expert users' }, { status: 403 });
        }

        const form = await req.formData();
        const file = form.get('document');
        const textField = form.get('text');
        const analysisType = form.get('analysisType') || 'contract';
        const analysisMode = form.get('analysisMode') || 'feedback-driven';
        const role = form.get('role') || userRole;

        // Accept either a file or raw text from experts via the HIL UI
        if (!file && (!textField || String(textField).trim().length === 0)) {
            return NextResponse.json({ error: 'Document file or text is required' }, { status: 400 });
        }

        // If file provided, extract text from the upload; otherwise use provided text directly
        let filePath = null;
        let text = '';
        let fileName = `text_input_${Date.now()}.txt`;

        if (file) {
          // read uploaded file buffer and extract text
          const buffer = Buffer.from(await file.arrayBuffer());
          try {
            const textObj = await extractTextFromPDF(buffer);
            text = textObj?.text || '';
          } catch (e) {
            console.warn('PDF extraction failed in HIL Analyzer:', e?.message || e);
            const fallback = String(await (async () => { try { return new TextDecoder().decode(buffer); } catch { return ''; } })());
            text = fallback || '';
          }
          fileName = file.name || fileName;
        } else {
          text = String(textField || '');
        }

        // Run the canonical analyzer (same as /api/analyze) to get consistent results
        let analysisResult = null;
        try {
          const { analyzeText } = await import('@/lib/analyzer');
          const analyzed = await analyzeText(text, fileName, role);
          // normalize to expected structure
          analysisResult = analyzed.analysis || analyzed;
        } catch (err) {
          console.warn('analyzeText failed for HIL Analyzer, falling back to local HIL prompt:', err?.message || err);
          // Fallback: minimal HIL analyzer that returns a basic structure
          try {
            const hilPromptData = await generateHILAwarePrompt(text, role);
            const res = await ollamaClient.chat([{ role: 'user', content: `Document Text:\n${text}\n\nAnalyze this contract.` }], `HIL CONTEXT:\n${hilPromptData.hil_context}`);
            const respText = typeof res === 'string' ? res : JSON.stringify(res);
            const m = respText.match(/\{[\s\S]*\}/);
            analysisResult = m ? JSON.parse(m[0]) : { summary: 'Fallback analysis: model did not return JSON.' };
          } catch (e) {
            console.error('Fallback HIL prompt failed:', e);
            return NextResponse.json({ error: 'HIL analysis failed' }, { status: 500 });
          }
        }

        // Persist a HIL feedback record for this analysis (pending expert review)
        await connectMongoose();
        const defaultAdmin = (process.env.DEFAULT_ADMIN_EMAILS || 'ayusht5071@gmail.com').split(',')[0].trim().toLowerCase();
        await ensureAdminSetup(defaultAdmin);

        const session = await getServerSession();
        const userEmail = session?.user?.email || token?.email || 'system@local';

        const analysisId = analysisResult?.analysisId || `hil_${analysisType}_${Date.now()}`;

        const fb = new Feedback({
          analysisId,
          type: 'hil_analysis',
          documentName: fileName,
          userEmail,
          expertEmail: userEmail,
          originalAnalysis: analysisResult,
          payload: {
            document_text: text,
            analysis_type: analysisType,
            analysis_mode: analysisMode,
            user_role: role,
            raw_response: analysisResult || null
          },
          status: 'pending_expert_review',
          metadata: {
            hil_mode: true,
            training_priority: analysisResult?.hil_metadata?.expert_review_priority || 'medium',
            confidence_score: analysisResult?.initial_analysis?.confidence || 0,
            apply_to_vector_store: true
          }
        });

        await fb.save();

        // Assess training quality
        let trainingQuality = { quality_score: 0, training_value: 'unknown' };
        try {
          trainingQuality = assessTrainingQuality({ ...fb.toObject(), payload: fb.payload, metadata: fb.metadata });
        } catch (e) { console.warn('Training quality assessment failed:', e?.message || e); }

        // Store feedback embedding (non-blocking)
        let vectorsAdded = 0;
        try {
          await storeFeedbackEmbedding(fb);
          vectorsAdded = 1;
        } catch (e) { console.warn('storeFeedbackEmbedding error:', e?.message || e); }

        // Return the HIL analysis result and tracking info
        const result = {
          analysisId,
          feedback_id: fb._id,
          initial_analysis: analysisResult?.initial_analysis || analysisResult || null,
          raw: analysisResult,
          feedback_prompted: true,
          training_impact: {
            vectors_added: vectorsAdded,
            feedback_records: 1,
            quality_score: trainingQuality.quality_score,
            training_value: trainingQuality.training_value
          }
        };

        return NextResponse.json(result);
    } catch (error) {
        console.error('HIL Analyzer error:', error);
        return NextResponse.json({
            error: error?.message || 'HIL analysis failed'
        }, { status: 500 });
    }
}