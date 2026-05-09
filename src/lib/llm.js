import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Ollama client for Qwen
export class OllamaClient {
  constructor() {
    this.baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'qwen2:1.5b';
  }

  async chat(messages, systemPrompt = null) {
    try {
      const prompt = this.buildPrompt(messages, systemPrompt);

      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
        },
      });

      return response.data.response;
    } catch (error) {
      console.error('Error calling Ollama:', error);
      throw new Error('Failed to get response from Qwen');
    }
  }

  buildPrompt(messages, systemPrompt) {
    let prompt = '';

    if (systemPrompt) {
      prompt += `System: ${systemPrompt}\n\n`;
    }

    messages.forEach((msg) => {
      if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n`;
      } else if (msg.role === 'assistant') {
        prompt += `Assistant: ${msg.content}\n`;
      }
    });

    prompt += 'Assistant: ';
    return prompt;
  }
}

// Gemini client for structured analysis
export class GeminiClient {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.available = !!apiKey;
    if (!this.available) {
      console.warn('GEMINI_API_KEY is not set; GeminiClient will be unavailable');
      return;
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
    try {
      this.model = this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.3,
          topP: 0.95,
          topK: 40,
        },
      });
    } catch (err) {
      console.error(`Failed to initialize Gemini model '${modelName}':`, err?.message || err);
      console.warn('Gemini client will be disabled; falling back to local models only.');
      this.available = false;
      return;
    }
  }

  async analyzeContract(context, schema) {
    try {
      if (!this.available) {
        throw new Error('Gemini client is not configured (GEMINI_API_KEY missing)');
      }

      const prompt = this.buildAnalysisPrompt(context);

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // Validate against schema if provided
      if (schema) {
        schema.parse(analysis);
      }

      return analysis;
    } catch (error) {
      console.error('Error calling Gemini:', error);
      throw new Error('Failed to analyze contract with Gemini');
    }
  }

  buildAnalysisPrompt(context) {
    return `You are a legal contract analysis expert. Analyze the following contract text and provide a comprehensive risk assessment.

CONTRACT TEXT:
${context}

INSTRUCTIONS:
- Analyze all clauses and identify potential risks
- Assign a risk score to each clause (0-100, where 0 is no risk and 100 is critical risk)
- Calculate an overall final score (0-100)
- Provide a concise summary
- Be objective and thorough

OUTPUT FORMAT (strict JSON only):
{
  "final_score": <number 0-100>,
  "summary": "<string>",
  "clauses": [
    {
      "clause_name": "<string>",
      "risk_level": "<low|medium|high|critical>",
      "risk_score": <number 0-100>,
      "description": "<string>",
      "recommendations": "<string>"
    }
  ]
}

Respond with ONLY the JSON object, no additional text.`;
  }
}

// Create singleton instances
export const ollamaClient = new OllamaClient();
export const geminiClient = new GeminiClient();
