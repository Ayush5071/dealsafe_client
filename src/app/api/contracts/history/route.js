import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectMongoose } from '@/lib/mongoose';
import Feedback from '@/lib/models/Feedback';

export async function GET(request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectMongoose();

        const email = session.user.email;

        // Fetch all feedback/analysis records for this user
        // We only want records that have an originalAnalysis with clauses
        const records = await Feedback.find({
            userEmail: email,
            'originalAnalysis.clauses': { $exists: true, $type: 'array' },
            documentName: { $not: { $regex: ' vs ', $options: 'i' } }
        })
            .sort({ createdAt: -1 })
            .select('documentName originalAnalysis createdAt')
            .limit(20)
            .lean();

        // Map to simplified contract object
        const contracts = records.map(record => {
            const analysis = record.originalAnalysis;
            return {
                id: record._id.toString(),
                name: record.documentName,
                risk: analysis.final_score || analysis.risk_score || 0,
                summary: analysis.summary || '',
                createdAt: record.createdAt,
                type: 'database'
            };
        });

        return NextResponse.json({ success: true, contracts });
    } catch (error) {
        console.error('Contract history error:', error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
