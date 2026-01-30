// Configuration constants
export const CONFIG = {
  // Chunk settings
  CHUNK_SIZE: 500,
  CHUNK_OVERLAP: 50,
  
  // Vector DB settings
  VECTOR_SIZE: 384, // MiniLM embedding size
  COLLECTION_NAME: 'documents',
  TOP_K_RESULTS: 5,
  
  // LLM settings
  OLLAMA_TEMPERATURE: 0.7,
  GEMINI_TEMPERATURE: 0.3,
  MAX_CONTEXT_LENGTH: 30000,
  
  // File upload settings
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: ['application/pdf'],
  
  // RAG settings
  UNKNOWN_ANSWER: "I don't know",
  UNKNOWN_PHRASES: [
    "i don't know",
    "i do not know",
    "not mentioned",
    "not found in the context",
    "no information",
    "not provided",
  ],
};

// Get environment variables with defaults
export const ENV = {
  OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'qwen2:1.5b',
  SQLITE_DB_PATH: process.env.SQLITE_DB_PATH || null,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || null,
  NODE_ENV: process.env.NODE_ENV || 'development',
};

// Validate required environment variables
export function validateEnv() {
  // No strictly required env vars for local development. Optionally set GEMINI_API_KEY or SQLITE_DB_PATH.
  return;
}
