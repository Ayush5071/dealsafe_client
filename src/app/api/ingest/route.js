import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

import { extractTextFromPDF, chunkText } from "@/lib/pdfParser";
import { generateEmbeddings } from "@/lib/embeddings";
import vectorDb from "@/lib/vectorDb";

export const runtime = "nodejs"; // IMPORTANT

const EMBEDDING_BATCH_SIZE = 50;

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const filename = body.filename ?? null;

    const pdfDir = path.join(process.cwd(), "pdfs");

    // Check pdfs directory
    try {
      await fs.access(pdfDir);
    } catch {
      return NextResponse.json(
        { error: "No pdfs folder found" },
        { status: 400 }
      );
    }

    const allFiles = (await fs.readdir(pdfDir)).filter((f) =>
      f.toLowerCase().endsWith(".pdf")
    );

    const filesToProcess = filename
      ? allFiles.filter((f) => f === filename)
      : allFiles;

    if (filesToProcess.length === 0) {
      return NextResponse.json(
        { error: "No PDF files found to process" },
        { status: 400 }
      );
    }

    let totalChunks = 0;

    for (const file of filesToProcess) {
      const filePath = path.join(pdfDir, file);
      const buffer = await fs.readFile(filePath);

      const { text } = await extractTextFromPDF(buffer);
      if (!text || !text.trim()) continue;

      const chunks = chunkText(text);

      // ---- Batch embedding generation ----
      for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
        const embeddings = await generateEmbeddings(batch);

        const vectors = batch.map((chunk, idx) => ({
          text: chunk,
          embedding: embeddings[idx],
          metadata: {
            source: file,
            chunkId: i + idx,
            page: null,
          },
        }));

        await vectorDb.addVectors(vectors);
        totalChunks += vectors.length;
      }

      console.log(`✔ Processed ${file} (${chunks.length} chunks)`);
    }

    return NextResponse.json({
      success: true,
      processedChunks: totalChunks,
    });
  } catch (error) {
    console.error("❌ Error ingesting PDFs:", error);
    return NextResponse.json(
      { error: error.message ?? "Failed to ingest PDFs" },
      { status: 500 }
    );
  }
}
