import { NextResponse } from 'next/server';
import { generateCompanyReviews } from '@/lib/reviewGenerator';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const company = searchParams.get('company') || '';

        if (!company) {
            return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
        }

        // Generate dynamic reviews using LangGraph-powered agent with Qwen
        console.log(`Generating dynamic reviews for: ${company}`);
        const reviewData = await generateCompanyReviews(company, 3);

        return NextResponse.json(reviewData);
    } catch (error) {
        console.error('Error generating company reviews:', error);
        return NextResponse.json({
            error: 'Failed to generate reviews',
            details: error?.message || 'Unknown error'
        }, { status: 500 });
    }
}
