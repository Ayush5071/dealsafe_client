import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getServerSession } from 'next-auth';
import { extractTextFromPDF, chunkText } from '@/lib/pdfParser';
import { generateEmbeddings } from '@/lib/embeddings';
import vectorDb from '@/lib/vectorDb';
import { classifyChunks } from '@/lib/clauseClassifier';
import { uploadWorkflow } from '@/lib/workflows/uploadWorkflow';
import { connectMongoose } from '@/lib/mongoose';
import Feedback from '@/lib/models/Feedback';
import { getUserProfile, ensureAdminSetup } from '@/lib/db';
import { submitForExpertReview } from '@/lib/hilOrchestrator';
import { analyzeFile } from '@/lib/analyzer';
import { scrapeRelatedClauses } from '@/lib/firecrawlAgent';

// Helper function to estimate page number from chunk position
function estimatePageNumber(chunk, fullText, totalPages) {
  const chunkPosition = fullText.indexOf(chunk);
  if (chunkPosition === -1) return 1;
  const ratio = chunkPosition / fullText.length;
  return Math.max(1, Math.ceil(ratio * totalPages));
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type (allow PDF and DOCX)
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only PDF and DOCX files are allowed' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save uploaded file to uploads/ with a unique name
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const uniqueName = `${Date.now()}_${safeName}`;
    const uploadPath = path.join(uploadsDir, uniqueName);
    fs.writeFileSync(uploadPath, buffer);

    console.log('Extracting text from uploaded PDF...');
    // Extract text from PDF
    const { text, numPages } = await extractTextFromPDF(buffer);

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'No text found in PDF' },
        { status: 400 }
      );
    }

    console.log('Chunking text...');
    // Chunk the text
    const chunks = chunkText(text, 500, 50);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: 'Failed to process PDF text' },
        { status: 500 }
      );
    }

    console.log(`Generated ${chunks.length} chunks`);
    console.log('Generating embeddings...');

    // Generate embeddings for all chunks
    const embeddings = await generateEmbeddings(chunks);

    console.log('Embeddings generated, storing in vector DB...');

    // Prepare data for vector DB; use the uniqueName as source so we can retrieve later
    // Classify each chunk to detect clause category and predatory flags
    const chunkTags = await classifyChunks(chunks);

    const vectors = chunks.map((chunk, idx) => ({
      text: chunk,
      embedding: embeddings[idx],
      metadata: {
        source: uniqueName,
        chunkId: idx,
        page: estimatePageNumber(chunk, text, numPages),
      },
      tags: chunkTags[idx] || {},
    }));

    // Store in vector database
    const result = await vectorDb.addVectors(vectors);

    console.log('Upload processed and stored. Running analysis...');

    // Get user session for parallel Firecrawl agent
    const session = await getServerSession();
    const userEmail = session?.user?.email;

    // Run analysis and Firecrawl scraping in parallel (only if user is logged in)
    let analysis = null;
    let scrapedClauses = [];
    let deletedUpload = false;
    let uploadResultExpert = null;

    try {
      const promises = [analyzeFile(uniqueName)];

      if (userEmail) {
        console.log('User logged in, starting parallel Firecrawl agent...');
        promises.push(scrapeRelatedClauses(text));
      }

      const results = await Promise.all(promises);

      const analyzeResult = results[0] || {};
      analysis = analyzeResult?.analysis || null;
      const external_contexts = analyzeResult?.external_contexts || [];

      if (userEmail && results[1]) {
        scrapedClauses = results[1];
        console.log(`Firecrawl agent found ${scrapedClauses.length} related clauses`);
      }

      // HIL is OPTIONAL: only submitted when client requests it via form field 'useHIL' or header 'x-use-hil'
      try {
        const useHIL = (form && typeof form.get === 'function' && (form.get('useHIL') === 'true' || form.get('useHIL') === '1')) || (request.headers?.get('x-use-hil') === 'true');
        // Explicit feedback creation must be requested by client to avoid auto-creating records
        const createFeedback = (form && typeof form.get === 'function' && (form.get('createFeedback') === 'true' || form.get('createFeedback') === '1')) || (request.headers?.get('x-create-feedback') === 'true');

        if (useHIL && userEmail && analysis) {
          await connectMongoose();
          await ensureAdminSetup();

          const hilResult = await submitForExpertReview(
            analysis,
            userEmail,
            'upload',
            {
              documentName: uniqueName,
              document_text: text,
              chunks_processed: result.count,
              pages: numPages,
              scraped_clauses: scrapedClauses,
              external_contexts: analyzeResult?.external_contexts || [],
              user_role: (await getUserProfile(userEmail))?.role || 'unknown'
            }
          );

          uploadResultExpert = {
            hil_mandatory: true,
            hil_id: hilResult.hil_id,
            analysis_id: hilResult.analysis_id,
            status: hilResult.status,
            message: hilResult.message,
            estimated_review_time: hilResult.estimated_review_time
          };

          // Hide analysis until expert approves
          analysis = null;
        } else if (createFeedback) {
          // Only create a non-blocking feedback record if explicitly requested by client
          try {
            await connectMongoose();
            const defaultAdmin = (process.env.DEFAULT_ADMIN_EMAILS || 'ayusht5071@gmail.com').split(',')[0].trim().toLowerCase();
            await ensureAdminSetup(defaultAdmin);

            const fb = new Feedback({
              analysisId: `upload_${Date.now()}`,
              type: 'upload',
              documentName: uniqueName,
              userEmail: userEmail || 'anonymous',
              expertEmail: defaultAdmin,
              originalAnalysis: analysis || {},
              payload: { document_text: text },
              status: 'pending'
            });
            await fb.save();
            const pendingFeedbackId = fb._id;
            try {
              const { storeFeedbackEmbedding } = await import('@/lib/feedbackEmbeddings');
              storeFeedbackEmbedding(fb).catch((e) => console.warn('storeFeedbackEmbedding error:', e));
            } catch (e) {
              console.warn('Failed to queue feedback embedding:', e?.message || e);
            }
          } catch (e) {
            console.warn('Failed to create explicit feedback record:', e?.message || e);
          }
        } else {
          // No HIL and no explicit feedback requested: do nothing (no auto feedback creation)
        }
      } catch (e) {
        console.warn('HIL processing error (non-fatal):', e?.message || e);
      }
    } finally {
      // Remove the uploaded PDF from uploads/ for security after analysis attempt
      try {
        fs.unlinkSync(uploadPath);
        deletedUpload = true;
        console.log(`Deleted uploaded file: ${uploadPath}`);
      } catch (e) {
        console.warn('Failed to delete uploaded file:', e?.message || e);
      }
    }

    console.log('Upload complete!');

    return NextResponse.json({
      success: true,
      filename: uniqueName,
      chunks: result.count,
      pages: numPages,
      message: 'PDF uploaded and processed successfully',
      analysis,
      external_contexts: (typeof external_contexts !== 'undefined' ? external_contexts : []),
      scraped_clauses: scrapedClauses,
      deleted_upload: deletedUpload,
      ...(uploadResultExpert || {}),
      ...(typeof pendingFeedbackId !== 'undefined' ? { pending_feedback_id: pendingFeedbackId } : {})
    });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload PDF' },
      { status: 500 }
    );
  }
}
