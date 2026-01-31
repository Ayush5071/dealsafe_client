import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ollamaClient } from '@/lib/llm';
import vectorDb from '@/lib/vectorDb';

/**
 * LangGraph-powered Negotiation Assistant
 * Provides role-specific negotiation tips for contracts
 */

// Role-specific negotiation focus areas
const ROLE_FOCUS = {
    'Freelancer': {
        focus: ['payment terms', 'IP rights', 'scope creep protection', 'termination clauses', 'late payment penalties'],
        concerns: ['unclear deliverables', 'unlimited revisions', 'IP transfer without compensation', 'no kill fee']
    },
    'Startup Founder': {
        focus: ['equity protection', 'vesting schedules', 'non-compete scope', 'liability caps', 'exit clauses'],
        concerns: ['excessive equity dilution', 'broad non-compete', 'unlimited liability', 'unfavorable vesting']
    },
    'Corporate Employee': {
        focus: ['salary negotiation', 'benefits', 'non-compete restrictions', 'severance', 'equity/stock options'],
        concerns: ['below-market compensation', 'weak benefits', 'restrictive non-compete', 'no severance']
    },
    'HR': {
        focus: ['compliance', 'liability protection', 'termination procedures', 'confidentiality', 'dispute resolution'],
        concerns: ['non-compliance risks', 'weak IP protection', 'unclear termination process', 'litigation exposure']
    },
    'Recruiter': {
        focus: ['commission structure', 'client exclusivity', 'candidate ownership', 'payment terms', 'contract duration'],
        concerns: ['unclear commission', 'unfair exclusivity', 'candidate poaching clauses', 'delayed payments']
    }
};

export async function POST(request) {
    try {
        const { filename, contractText, userRole } = await request.json();

        if (!contractText) {
            return NextResponse.json({ error: 'Contract text is required' }, { status: 400 });
        }

        // Get user session for role if not provided
        let role = userRole;
        if (!role) {
            const session = await getServerSession();
            if (session?.user?.email) {
                const { getUserProfile } = await import('@/lib/db');
                const profile = await getUserProfile(session.user.email);
                role = profile?.role || 'Freelancer';
            } else {
                role = 'Freelancer'; // Default
            }
        }

        console.log(`[Negotiation API] Generating tips for role: ${role}`);

        // Get role-specific focus areas
        const roleFocus = ROLE_FOCUS[role] || ROLE_FOCUS['Freelancer'];

        // LangGraph Workflow: Analyze → Generate Suggestions → Prioritize
        const prompt = `You are a professional contract negotiation advisor. Analyze this contract and provide negotiation tips for a ${role}.

CONTRACT TEXT:
${contractText.substring(0, 3000)}

FOCUS AREAS FOR ${role.toUpperCase()}:
${roleFocus.focus.join(', ')}

COMMON CONCERNS:
${roleFocus.concerns.join(', ')}

Provide 5-7 specific, actionable negotiation tips. For each tip:
1. Identify the weak point in the contract
2. Explain why it's problematic for a ${role}
3. Provide specific negotiation language to use
4. Rate priority (High/Medium/Low)

Return ONLY a JSON object:
{
  "suggestions": [
    {
      "title": "Brief title",
      "weakPoint": "What's wrong",
      "impact": "Why it matters for ${role}",
      "negotiationTip": "Specific language to use",
      "priority": "High/Medium/Low"
    }
  ]
}`;

        const response = await ollamaClient.chat(
            [{ role: 'user', content: prompt }],
            `You are an expert contract negotiation advisor specializing in ${role} contracts.`
        );

        // Parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse negotiation suggestions');
        }

        const result = JSON.parse(jsonMatch[0]);

        return NextResponse.json({
            success: true,
            role,
            suggestions: result.suggestions || [],
            generatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Negotiation API error:', error);
        return NextResponse.json({
            error: 'Failed to generate negotiation tips',
            details: error?.message || 'Unknown error'
        }, { status: 500 });
    }
}
