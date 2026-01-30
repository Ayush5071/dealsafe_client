import { z } from 'zod';

export const ClauseSchema = z.object({
  clause_name: z.string(),
  clause_text: z.string().optional(),
  category: z.string().optional(), // payment, termination, liability, IP, etc.
  risk_level: z.enum(['low', 'medium', 'high', 'critical']),
  risk_score: z.number().min(0).max(100),
  description: z.string(),
  recommendations: z.string(),
  india_laws: z.array(z.string()).optional(),
  rewrite_suggestion: z.string().optional(),
});

export const ContractAnalysisSchema = z.object({
  final_score: z.number().min(0).max(100),
  summary: z.string(),
  clauses: z.array(ClauseSchema),
  predatory_index: z.number().min(0).max(100).optional(),
  trust_score: z.number().min(0).max(100).optional(),
  missing_clauses: z.array(z.string()).optional(),
  negotiation_questions: z.array(z.string()).optional(),
  recommendations: z.string().optional(),
});
