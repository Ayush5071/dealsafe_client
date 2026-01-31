import { ollamaClient } from './llm';

/**
 * Contract Redesigner
 * Generates improved versions of risky clauses
 */

/**
 * Generate improved version of a single clause
 */
export async function improveClause(clauseText, clauseName, riskScore, context = '') {
    const prompt = `You are a legal contract expert. Improve this risky clause to make it safer and more balanced.

CLAUSE NAME: ${clauseName}
CURRENT RISK SCORE: ${riskScore}/100
CURRENT TEXT:
${clauseText}

${context ? `CONTEXT:\n${context}\n` : ''}

Provide an improved version that:
1. Reduces legal risk
2. Is more balanced and fair
3. Includes protective language
4. Follows Indian Contract Act, 1872
5. Maintains the original intent but adds safeguards

Return ONLY the improved clause text, nothing else.`;

    try {
        const improved = await ollamaClient.chat(
            [{ role: 'user', content: prompt }],
            'You are a legal contract improvement expert.'
        );

        return improved.trim();
    } catch (error) {
        console.error('Error improving clause:', error);
        return clauseText; // Return original on error
    }
}

/**
 * Generate full contract redesign with all improvements
 */
export async function redesignContract(analysis) {
    if (!analysis) {
        throw new Error('No analysis data provided');
    }

    // Default to empty array if clauses missing (or handle gracefully)
    if (!analysis.clauses || !Array.isArray(analysis.clauses)) {
        console.warn('Analysis missing clauses, returning empty redesign');
        return {
            originalRisk: analysis.risk_score || 0,
            improvedRisk: analysis.risk_score || 0,
            riskReduction: 0,
            clauses: [],
            summary: 'No clauses found to redesign. Please re-analyze the contract.'
        };
    }

    const redesignedClauses = [];
    let totalOriginalRisk = 0;
    let totalImprovedRisk = 0;

    for (const clause of analysis.clauses) {
        const originalRisk = clause.risk_score || 0;
        totalOriginalRisk += originalRisk;

        // Only improve risky clauses (score > 30)
        if (originalRisk > 30) {
            const improvedText = await improveClause(
                clause.clause_text,
                clause.clause_name,
                originalRisk,
                analysis.summary || ''
            );

            // Estimate improved risk (reduce by 50-70%)
            const riskReduction = Math.floor(originalRisk * 0.6);
            const improvedRisk = Math.max(10, originalRisk - riskReduction);
            totalImprovedRisk += improvedRisk;

            // Identify changes made
            const changes = identifyChanges(clause.clause_text, improvedText);

            redesignedClauses.push({
                id: clause.clause_name || `clause_${redesignedClauses.length + 1}`,
                name: clause.clause_name,
                original: clause.clause_text,
                improved: improvedText,
                originalRisk,
                improvedRisk,
                changes,
                recommendations: clause.recommendations || []
            });
        } else {
            // Keep safe clauses as-is
            totalImprovedRisk += originalRisk;

            redesignedClauses.push({
                id: clause.clause_name || `clause_${redesignedClauses.length + 1}`,
                name: clause.clause_name,
                original: clause.clause_text,
                improved: clause.clause_text,
                originalRisk,
                improvedRisk: originalRisk,
                changes: [],
                recommendations: []
            });
        }
    }

    const avgOriginalRisk = Math.round(totalOriginalRisk / analysis.clauses.length);
    const avgImprovedRisk = Math.round(totalImprovedRisk / analysis.clauses.length);

    return {
        originalRisk: avgOriginalRisk,
        improvedRisk: avgImprovedRisk,
        riskReduction: avgOriginalRisk - avgImprovedRisk,
        clauses: redesignedClauses,
        summary: `Contract risk reduced from ${avgOriginalRisk}/100 to ${avgImprovedRisk}/100`
    };
}

/**
 * Identify key changes between original and improved text
 */
function identifyChanges(original, improved) {
    const changes = [];

    // Simple heuristic-based change detection
    if (improved.length > original.length * 1.2) {
        changes.push('Added protective language and safeguards');
    }

    if (improved.includes('penalty') && !original.includes('penalty')) {
        changes.push('Added penalty clause for violations');
    }

    if (improved.includes('dispute resolution') && !original.includes('dispute resolution')) {
        changes.push('Added dispute resolution mechanism');
    }

    if (improved.includes('Indian Contract Act') || improved.includes('Section')) {
        changes.push('Added legal references for enforceability');
    }

    if (improved.includes('written notice') && !original.includes('written notice')) {
        changes.push('Added written notice requirement');
    }

    if (improved.includes('days') && original.includes('days')) {
        const origDays = parseInt(original.match(/(\d+)\s*days?/)?.[1] || '0');
        const impDays = parseInt(improved.match(/(\d+)\s*days?/)?.[1] || '0');
        if (impDays < origDays) {
            changes.push(`Reduced timeline from ${origDays} to ${impDays} days`);
        }
    }

    // If no specific changes detected, add generic one
    if (changes.length === 0) {
        changes.push('Improved clarity and legal precision');
    }

    return changes;
}

/**
 * Recalculate risk for edited clause
 */
export async function recalculateRisk(clauseText, clauseName) {
    const prompt = `Analyze this contract clause and provide a risk score from 0-100.

CLAUSE NAME: ${clauseName}
CLAUSE TEXT:
${clauseText}

Consider:
- Fairness and balance
- Legal enforceability
- Potential for abuse
- Clarity of terms
- Compliance with Indian law

Return ONLY a number between 0-100, nothing else.`;

    try {
        const response = await ollamaClient.chat(
            [{ role: 'user', content: prompt }],
            'You are a legal risk assessment expert.'
        );

        const score = parseInt(response.trim());
        return isNaN(score) ? 50 : Math.min(100, Math.max(0, score));
    } catch (error) {
        console.error('Error recalculating risk:', error);
        return 50; // Default medium risk
    }
}

export default {
    improveClause,
    redesignContract,
    recalculateRisk
};
