import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { redesignContract, improveClause, recalculateRisk } from '@/lib/contractRedesigner';
import { analyzeFile } from '@/lib/analyzer';
import { connectMongoose } from '@/lib/mongoose';
import Feedback from '@/lib/models/Feedback';

/**
 * Contract Redesign API
 * Generates improved contract versions
 */

export async function POST(request) {
    try {
        const body = await request.json();
        const { action, filename, clauseText, clauseName, analysis } = body;
        const session = await getServerSession();
        const userEmail = session?.user?.email;

        // Action: Full contract redesign
        if (action === 'redesign') {
            if (!filename && !analysis) {
                return NextResponse.json(
                    { error: 'Filename or analysis required' },
                    { status: 400 }
                );
            }

            let contractAnalysis = analysis;

            // If filename provided, try to fetch from DB first, else analyze
            if (filename && !analysis) {
                if (userEmail) {
                    try {
                        await connectMongoose();
                        const record = await Feedback.findOne({
                            userEmail,
                            documentName: filename,
                            originalAnalysis: { $exists: true }
                        }).sort({ createdAt: -1 });

                        if (record?.originalAnalysis) {
                            console.log('Using cached analysis for redesign:', filename);
                            contractAnalysis = record.originalAnalysis;
                        }
                    } catch (e) {
                        console.warn('DB fetch failed, falling back to fresh analysis');
                    }
                }

                if (!contractAnalysis) {
                    console.log('Running fresh analysis for redesign...');
                    const result = await analyzeFile(filename);
                    contractAnalysis = result.analysis;
                }
            }

            console.log('Generating contract redesign...');
            const redesign = await redesignContract(contractAnalysis);

            return NextResponse.json({
                success: true,
                redesign
            });
        }

        // Action: Improve single clause
        if (action === 'improve_clause') {
            if (!clauseText || !clauseName) {
                return NextResponse.json(
                    { error: 'Clause text and name required' },
                    { status: 400 }
                );
            }

            const riskScore = body.riskScore || 50;
            const improved = await improveClause(clauseText, clauseName, riskScore);

            return NextResponse.json({
                success: true,
                improved
            });
        }

        // Action: Recalculate risk
        if (action === 'recalculate_risk') {
            if (!clauseText || !clauseName) {
                return NextResponse.json(
                    { error: 'Clause text and name required' },
                    { status: 400 }
                );
            }

            const riskScore = await recalculateRisk(clauseText, clauseName);

            return NextResponse.json({
                success: true,
                riskScore
            });
        }

        return NextResponse.json(
            { error: 'Invalid action' },
            { status: 400 }
        );

    } catch (error) {
        console.error('Redesign API error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to process redesign request' },
            { status: 500 }
        );
    }
}
