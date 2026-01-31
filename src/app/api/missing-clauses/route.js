import { NextResponse } from 'next/server';
import { ollamaClient } from '@/lib/llm';

/**
 * LangGraph-powered Missing Clause Detector
 * Identifies important missing clauses in contracts
 */

// Standard clauses by contract type
const STANDARD_CLAUSES = {
    'Employment': [
        'Compensation and benefits',
        'Job responsibilities',
        'Termination conditions',
        'Confidentiality and NDA',
        'Intellectual property assignment',
        'Non-compete clause',
        'Dispute resolution',
        'Severance terms'
    ],
    'Freelance': [
        'Scope of work',
        'Payment terms and schedule',
        'Intellectual property rights',
        'Liability limitations',
        'Termination clause',
        'Confidentiality',
        'Dispute resolution',
        'Kill fee provision'
    ],
    'NDA': [
        'Definition of confidential information',
        'Exclusions from confidentiality',
        'Term and duration',
        'Return of materials',
        'Remedies for breach',
        'Jurisdiction and governing law'
    ],
    'Service Agreement': [
        'Scope of services',
        'Payment terms',
        'Warranties and representations',
        'Indemnification',
        'Liability caps',
        'Termination rights',
        'Dispute resolution'
    ]
};

export async function POST(request) {
    try {
        const { contractText, contractType } = await request.json();

        if (!contractText) {
            return NextResponse.json({ error: 'Contract text is required' }, { status: 400 });
        }

        // Auto-detect contract type if not provided
        let detectedType = contractType || 'Employment';

        if (!contractType) {
            const typePrompt = `Classify this contract type. Respond with ONLY one word: Employment, Freelance, NDA, or ServiceAgreement.

CONTRACT:
${contractText.substring(0, 500)}`;

            const typeResponse = await ollamaClient.chat(
                [{ role: 'user', content: typePrompt }],
                'You are a contract classification expert.'
            );

            detectedType = typeResponse.trim().replace('ServiceAgreement', 'Service Agreement');
        }

        console.log(`[Missing Clause API] Analyzing ${detectedType} contract`);

        // Get standard clauses for this type
        const standardClauses = STANDARD_CLAUSES[detectedType] || STANDARD_CLAUSES['Employment'];

        // LangGraph Workflow: Check Clauses → Identify Missing → Assess Impact
        const prompt = `You are a legal contract expert. Analyze this ${detectedType} contract and identify missing important clauses.

CONTRACT TEXT:
${contractText.substring(0, 3000)}

STANDARD CLAUSES FOR ${detectedType.toUpperCase()}:
${standardClauses.map((c, i) => `${i + 1}. ${c}`).join('\n')}

For each MISSING clause:
1. Identify which standard clause is missing
2. Explain why it's important
3. Rate severity (Critical/High/Medium/Low)
4. Provide a template clause suggestion

Return ONLY a JSON object:
{
  "missingClauses": [
    {
      "clauseName": "Name of missing clause",
      "severity": "Critical/High/Medium/Low",
      "reason": "Why this is important",
      "impact": "What could go wrong without it",
      "suggestedClause": "Template text for the clause"
    }
  ]
}`;

        const response = await ollamaClient.chat(
            [{ role: 'user', content: prompt }],
            `You are an expert in ${detectedType} contracts and legal compliance.`
        );

        // Parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse missing clauses');
        }

        const result = JSON.parse(jsonMatch[0]);

        return NextResponse.json({
            success: true,
            contractType: detectedType,
            missingClauses: result.missingClauses || [],
            totalMissing: result.missingClauses?.length || 0,
            generatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Missing Clause API error:', error);
        return NextResponse.json({
            error: 'Failed to detect missing clauses',
            details: error?.message || 'Unknown error'
        }, { status: 500 });
    }
}
