import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getServerSession } from 'next-auth';
import { extractTextFromPDF } from '@/lib/pdfParser';
import { uploadWorkflow } from '@/lib/workflows/uploadWorkflow';

/**
 * Enhanced Upload API with LangGraph Workflow
 * Includes web scraping, confidence scoring, and clause extraction
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

        // Save uploaded file temporarily
        const uploadsDir = path.resolve(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const uniqueName = `${Date.now()}_${safeName}`;
        const uploadPath = path.join(uploadsDir, uniqueName);
        fs.writeFileSync(uploadPath, buffer);

        console.log('[Upload API] Extracting text from PDF...');
        const { text, numPages } = await extractTextFromPDF(buffer);

        if (!text || text.trim().length === 0) {
            fs.unlinkSync(uploadPath);
            return NextResponse.json(
                { error: 'No text found in PDF' },
                { status: 400 }
            );
        }

        console.log('[Upload API] Starting LangGraph Upload Workflow...');

        // Get user session
        const session = await getServerSession();
        const userEmail = session?.user?.email;

        // Execute LangGraph workflow
        const workflowResult = await uploadWorkflow.execute(
            text,
            uniqueName,
            userEmail
        );

        // Clean up uploaded file
        try {
            fs.unlinkSync(uploadPath);
            console.log('[Upload API] Deleted temporary file');
        } catch (e) {
            console.warn('Failed to delete temp file:', e.message);
        }

        if (workflowResult.status === 'error') {
            return NextResponse.json(
                { error: 'Workflow execution failed' },
                { status: 500 }
            );
        }

        console.log('[Upload API] Workflow complete!');

        // Return comprehensive response with confidence scores
        return NextResponse.json({
            success: true,
            filename: uniqueName,
            pages: numPages,
            chunks: workflowResult.chunks.length,
            message: 'PDF uploaded and analyzed successfully',

            // Analysis results
            analysis: workflowResult.analysis,

            // Clauses with confidence scores
            clauses: workflowResult.clauses.map(clause => ({
                ...clause,
                confidence: clause.confidence,
                confidenceBadge: clause.confidence === 100 ? '✓ Verified from PDF' :
                    clause.confidence >= 75 ? '⚡ Supported by web sources' :
                        '🤖 AI-extracted'
            })),

            // Web context
            webContext: workflowResult.webContext.length,
            webSources: workflowResult.webContext.map(w => w.source),

            // Workflow metadata
            workflow: {
                status: workflowResult.status,
                chunksProcessed: workflowResult.chunks.length,
                embeddingsGenerated: workflowResult.embeddings.length,
                webClausesFound: workflowResult.webContext.length,
                clausesExtracted: workflowResult.clauses.length
            }
        });

    } catch (error) {
        console.error('[Upload API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to upload PDF' },
            { status: 500 }
        );
    }
}
