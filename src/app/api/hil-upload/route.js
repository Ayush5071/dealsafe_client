import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getServerSession } from 'next-auth';
import { extractTextFromPDF } from '@/lib/pdfParser';
import { uploadWorkflow } from '@/lib/workflows/uploadWorkflow';
import enhancedVectorDb from '@/lib/enhancedVectorDb';

/**
 * HIL Upload API
 * Upload contracts for Human-in-the-Loop review to fine-tune the system
 */

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

        // Validate file type
        if (file.type !== 'application/pdf') {
            return NextResponse.json(
                { error: 'Only PDF files are allowed' },
                { status: 400 }
            );
        }

        // Get user session
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userEmail = session.user.email;

        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Save uploaded file temporarily
        const uploadsDir = path.resolve(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const uniqueName = `hil_${Date.now()}_${safeName}`;
        const uploadPath = path.join(uploadsDir, uniqueName);
        fs.writeFileSync(uploadPath, buffer);

        console.log('[HIL Upload] Extracting text from PDF...');
        const { text, numPages } = await extractTextFromPDF(buffer);

        if (!text || text.trim().length === 0) {
            fs.unlinkSync(uploadPath);
            return NextResponse.json(
                { error: 'No text found in PDF' },
                { status: 400 }
            );
        }

        console.log('[HIL Upload] Starting RAG workflow for HIL review...');

        // Execute upload workflow
        const workflowResult = await uploadWorkflow.execute(
            text,
            uniqueName,
            userEmail
        );

        // Clean up uploaded file
        try {
            fs.unlinkSync(uploadPath);
            console.log('[HIL Upload] Deleted temporary file');
        } catch (e) {
            console.warn('Failed to delete temp file:', e.message);
        }

        if (workflowResult.status === 'error') {
            return NextResponse.json(
                { error: 'Workflow execution failed' },
                { status: 500 }
            );
        }

        // Mark as pending admin review in enhanced vector DB
        // This flags it for the AI Training dashboard
        console.log('[HIL Upload] Marking for admin review...');

        // The workflow already stored vectors, now we just need to track it
        // as pending review (adminReviewed = 0 by default)

        console.log('[HIL Upload] Upload complete, pending admin review');

        // Return comprehensive response
        return NextResponse.json({
            success: true,
            filename: uniqueName,
            pages: numPages,
            chunks: workflowResult.chunks.length,
            message: 'PDF uploaded successfully and queued for admin review',

            // Analysis results (will be reviewed by admin)
            analysis: workflowResult.analysis,

            // Clauses with confidence scores
            clauses: workflowResult.clauses.map(clause => ({
                ...clause,
                confidence: clause.confidence,
                confidenceBadge: clause.confidence === 100 ? '✓ From PDF' :
                    clause.confidence >= 75 ? '⚡ Web-supported' :
                        '🤖 AI-extracted'
            })),

            // Web context
            webContext: workflowResult.webContext.length,

            // Workflow metadata
            workflow: {
                status: workflowResult.status,
                chunksProcessed: workflowResult.chunks.length,
                embeddingsGenerated: workflowResult.embeddings.length,
                webClausesFound: workflowResult.webContext.length,
                clausesExtracted: workflowResult.clauses.length
            },

            // HIL metadata
            hil: {
                pendingReview: true,
                userId: userEmail,
                source: uniqueName,
                submittedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[HIL Upload] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to upload PDF' },
            { status: 500 }
        );
    }
}
