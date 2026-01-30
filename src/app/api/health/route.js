import { NextResponse } from 'next/server';
import axios from 'axios';

// Health check endpoint
export async function GET(request) {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      ollama: 'checking',
      vectorDb: 'checking',
    },
  };

  // Check Ollama
  try {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    await axios.get(`${ollamaUrl}/api/tags`, { timeout: 3000 });
    health.services.ollama = 'healthy';
  } catch (error) {
    health.services.ollama = 'unhealthy';
    health.status = 'degraded';
  }

  // Check SQLite vector DB (data/vectors.db)
  try {
    const dbPath = process.env.SQLITE_DB_PATH || require('path').resolve(process.cwd(), 'data', 'vectors.db');
    const fs = require('fs');
    if (fs.existsSync(dbPath)) {
      // Try a quick read
      const content = fs.readFileSync(dbPath, { encoding: 'utf8' });
      health.services.vectorDb = 'healthy';
    } else {
      health.services.vectorDb = 'not found';
      health.status = 'degraded';
    }
  } catch (error) {
    health.services.vectorDb = 'unhealthy';
    health.status = 'degraded';
  }

  // Check Gemini (just verify API key exists)
  if (!process.env.GEMINI_API_KEY) {
    health.services.gemini = 'not configured';
    health.status = 'degraded';
  } else {
    health.services.gemini = 'configured';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}
