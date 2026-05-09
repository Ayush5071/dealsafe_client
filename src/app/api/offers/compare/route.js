import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { extractTextFromPDF } from '@/lib/pdfParser';
import { geminiClient, ollamaClient } from '@/lib/llm';

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get form data with PDF files
        const formData = await request.formData();
        const files = formData.getAll('offers');

        if (!files || files.length < 2) {
            return NextResponse.json({ error: 'Please upload at least 2 offer letters to compare' }, { status: 400 });
        }

        if (files.length > 4) {
            return NextResponse.json({ error: 'Maximum 4 offers can be compared at once' }, { status: 400 });
        }

        // Fetch user profile for personalized recommendations
        const profileRes = await fetch(`${process.env.NEXTAUTH_URL}/api/user/profile`, {
            headers: { cookie: request.headers.get('cookie') || '' }
        });
        const profileData = await profileRes.json();
        const userProfile = profileData.profile || {};

        // Extract text from all PDFs
        const offers = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const buffer = Buffer.from(await file.arrayBuffer());

            try {
                const { text } = await extractTextFromPDF(buffer);
                offers.push({
                    id: i + 1,
                    filename: file.name,
                    text: text.trim()
                });
            } catch (error) {
                console.error(`Error parsing PDF ${file.name}:`, error);
                return NextResponse.json({
                    error: `Failed to parse ${file.name}. Please ensure it's a valid PDF.`
                }, { status: 400 });
            }
        }

        // Build comprehensive analysis prompt
        const analysisPrompt = buildOfferComparisonPrompt(offers, userProfile);

        // Try Gemini first, fallback to Qwen
        let analysis;
        let aiProvider = 'gemini';

        try {
            if (geminiClient && geminiClient.available) {
                const result = await geminiClient.model.generateContent(analysisPrompt);
                const response = await result.response;
                const text = response.text();

                // Extract JSON from response
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('No JSON found in Gemini response');
                }
                analysis = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Gemini not available');
            }
        } catch (geminiError) {
            console.warn('Gemini analysis failed, falling back to Qwen:', geminiError?.message);
            aiProvider = 'qwen';

            try {
                const qwenResponse = await ollamaClient.chat(
                    [{ role: 'user', content: analysisPrompt }],
                    'You are an expert career advisor analyzing job offers.'
                );

                // Extract JSON from Qwen response
                const jsonMatch = qwenResponse.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('No JSON found in Qwen response');
                }
                analysis = JSON.parse(jsonMatch[0]);
            } catch (qwenError) {
                console.error('Both Gemini and Qwen failed:', qwenError);
                return NextResponse.json({
                    error: 'AI analysis failed. Please try again later.'
                }, { status: 500 });
            }
        }

        return NextResponse.json({
            success: true,
            analysis,
            aiProvider,
            offersCount: offers.length
        });

    } catch (error) {
        console.error('Error in offer comparison:', error);
        return NextResponse.json({
            error: 'Failed to compare offers: ' + (error?.message || 'Unknown error')
        }, { status: 500 });
    }
}

function buildOfferComparisonPrompt(offers, userProfile) {
    const userContext = `
USER PROFILE:
- Current Salary: ₹${userProfile.currentSalary || 'Not specified'}
- Years of Experience: ${userProfile.yearsExperience || 'Not specified'}
- Tech Stack: ${userProfile.techStack || 'Not specified'}
- Current Company: ${userProfile.currentCompany || 'Not specified'}
- Previous Companies: ${userProfile.previousCompanies || 'Not specified'}
`;

    const offersText = offers.map((offer, idx) => `
OFFER ${idx + 1} (${offer.filename}):
${offer.text.substring(0, 3000)}
`).join('\n---\n');

    return `You are an expert career advisor analyzing job offers for a software professional. Compare the following job offers and provide a comprehensive analysis.

${userContext}

${offersText}

INSTRUCTIONS:
1. Extract key details from each offer (company, role, salary, benefits, etc.)
2. Compare offers across multiple dimensions
3. Consider the user's profile and career trajectory
4. Provide a clear recommendation with reasoning
5. Be objective but consider user's context

OUTPUT FORMAT (strict JSON only):
{
  "offers": [
    {
      "id": 1,
      "company": "Company Name",
      "role": "Job Title",
      "salary": "Salary range or amount",
      "location": "Location",
      "benefits": ["Benefit 1", "Benefit 2"],
      "highlights": ["Key point 1", "Key point 2"],
      "concerns": ["Concern 1", "Concern 2"]
    }
  ],
  "comparison": {
    "compensation": "Comparison of total compensation packages",
    "growth": "Career growth opportunities comparison",
    "workLife": "Work-life balance comparison",
    "culture": "Company culture and values comparison"
  },
  "recommendation": {
    "recommendedOfferId": 1,
    "reasoning": "Detailed explanation of why this offer is recommended",
    "keyFactors": ["Factor 1", "Factor 2", "Factor 3"],
    "considerations": "Important points to consider before accepting"
  },
  "summary": "Brief overall summary of the comparison"
}

Respond with ONLY the JSON object, no additional text.`;
}
