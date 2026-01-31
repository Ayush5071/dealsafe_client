import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse/lib/pdf-parse.js';

export async function extractTextFromPDF(input) {
  // input can be a Buffer or a file path
  let buffer = null;
  try {
    if (typeof input === 'string') {
      buffer = fs.readFileSync(input);
    } else {
      buffer = input;
    }

    const data = await pdf(buffer);
    return {
      text: data.text,
      numPages: data.numpages,
      info: data.info,
    };
  } catch (error) {
    console.warn('Error parsing PDF:', error?.message || error);

    // If it looks like a DOCX (zip/PK header) or file extension .docx, try mammoth if available
    const ext = typeof input === 'string' ? path.extname(input).toLowerCase() : '';
    const isZip = buffer && buffer.slice && buffer.slice(0, 2) && buffer.slice(0, 2).toString() === 'PK';

    if (isZip || ext === '.docx') {
      try {
        const mammoth = await import('mammoth');
        const res = await mammoth.extractRawText({ buffer });
        return { text: res.value || '', numPages: 0, info: { parsedWith: 'mammoth' } };
      } catch (e) {
        console.warn('DOCX parsing not available or failed:', e?.message || e);
        throw new Error('Failed to parse file. It appears to be a DOCX; install `mammoth` (npm i mammoth) to enable DOCX parsing.');
      }
    }

    throw new Error('Failed to parse PDF file: ' + (error?.message || String(error)));
  }
}

export function chunkText(text, chunkSize = 500, overlap = 50) {
  const chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    const chunk = text.slice(startIndex, endIndex);

    // Only add non-empty chunks
    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }

    startIndex += chunkSize - overlap;
  }

  return chunks;
}

export function estimatePageNumber(text, fullText, numPages) {
  // Simple estimation based on character position
  const position = fullText.indexOf(text);
  if (position === -1) return null;

  const percentage = position / fullText.length;
  const estimatedPage = Math.ceil(percentage * numPages);
  return estimatedPage;
}
