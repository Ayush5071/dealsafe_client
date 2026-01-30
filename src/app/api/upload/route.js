import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { extractTextFromPDF, chunkText, estimatePageNumber } from '@/lib/pdfParser';
import { generateEmbeddings } from '@/lib/embeddings';
import vectorDb from '@/lib/vectorDb';
import { analyzeFile } from '@/lib/analyzer';
import { classifyChunks } from '@/lib/clauseClassifier';

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

    // Run analysis on the newly uploaded file
    let analysis = null;
    let deletedUpload = false;
    try {
      analysis = await analyzeFile(uniqueName);
    } catch (err) {
      console.error('Analysis failed:', err);
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
      deleted_upload: deletedUpload,
    });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload PDF' },
      { status: 500 }
    );
  }
}
