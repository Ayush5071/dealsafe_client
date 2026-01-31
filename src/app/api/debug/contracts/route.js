import { NextResponse } from 'next/server';
import { connectMongoose } from '@/lib/mongoose';
import Feedback from '@/lib/models/Feedback';
import { getServerSession } from 'next-auth';

export async function GET(request) {
    try {
        await connectMongoose();
        const session = await getServerSession();
        const userEmail = session?.user?.email;

        // Get all records for user, regardless of validity
        const allUserRecords = await Feedback.find({ userEmail })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        const debugInfo = allUserRecords.map(r => ({
            id: r._id,
            name: r.documentName,
            hasOriginalAnalysis: !!r.originalAnalysis,
            hasClauses: r.originalAnalysis?.clauses ? Array.isArray(r.originalAnalysis.clauses) : false,
            clausesCount: r.originalAnalysis?.clauses?.length || 0,
            createdAt: r.createdAt
        }));

        return NextResponse.json({
            success: true,
            currentUser: userEmail,
            count: allUserRecords.length,
            records: debugInfo
        });
    } catch (error) {
        return NextResponse.json({ error: error.message });
    }
}
