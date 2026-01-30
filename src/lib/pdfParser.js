import pdf from 'pdf-parse/lib/pdf-parse.js';

export async function extractTextFromPDF(buffer) {
  try {
    const data = await pdf(buffer);
    return {
      text: data.text,
      numPages: data.numpages,
      info: data.info,
    };
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF file');
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
