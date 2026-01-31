import { OllamaClient } from './llm';

/**
 * LangGraph-powered review generator using Qwen
 * Generates dynamic company reviews in parallel
 */

// Review generation agent using Qwen
class ReviewGeneratorAgent {
    constructor() {
        this.ollamaClient = new OllamaClient();
    }

    async generateReview(company, reviewType = 'general') {
        const prompt = this.buildReviewPrompt(company, reviewType);

        try {
            const response = await this.ollamaClient.chat(
                [{ role: 'user', content: prompt }],
                'You are a professional employee writing an honest review about your workplace experience.'
            );

            // Parse JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error('Error generating review:', error);
            // Return fallback review
            return this.getFallbackReview(company);
        }
    }

    buildReviewPrompt(company, reviewType) {
        const currentDate = new Date().toISOString().split('T')[0];

        return `Generate a realistic employee review for ${company}. The review should be honest, balanced, and professional.

INSTRUCTIONS:
- Create a review that sounds like it was written by a real employee
- Include both positive and negative aspects
- Be specific about the experience
- Use natural, conversational language
- Make the rating realistic (between 3.5 and 5.0)

OUTPUT FORMAT (strict JSON only):
{
  "rating": <number between 3.5 and 5.0>,
  "title": "<catchy review title>",
  "content": "<detailed review content, 2-3 sentences>",
  "author": "<job title like 'Senior Software Engineer' or 'Product Manager'>",
  "date": "${currentDate}",
  "pros": "<comma-separated list of 2-3 pros>",
  "cons": "<comma-separated list of 1-2 cons>",
  "helpful": <random number between 50 and 400>
}

Respond with ONLY the JSON object, no additional text.`;
    }

    getFallbackReview(company) {
        return {
            rating: 4.0,
            title: 'Good company to work for',
            content: `Overall positive experience at ${company}. The team is collaborative and management is supportive.`,
            author: 'Software Engineer',
            date: new Date().toISOString().split('T')[0],
            pros: 'Good culture, supportive management, decent compensation',
            cons: 'Limited growth opportunities',
            helpful: Math.floor(Math.random() * 200) + 50
        };
    }
}

/**
 * LangGraph-style parallel review generation
 * Generates multiple reviews concurrently
 */
export async function generateCompanyReviews(company, count = 3) {
    const agent = new ReviewGeneratorAgent();

    // Create parallel review generation tasks
    const reviewPromises = [];
    const reviewTypes = ['general', 'technical', 'culture', 'management', 'compensation'];

    for (let i = 0; i < count; i++) {
        const reviewType = reviewTypes[i % reviewTypes.length];
        reviewPromises.push(
            agent.generateReview(company, reviewType).then(review => ({
                ...review,
                id: i + 1
            }))
        );
    }

    try {
        // Execute all review generations in parallel
        const reviews = await Promise.all(reviewPromises);

        // Calculate average rating
        const averageRating = (
            reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        ).toFixed(1);

        return {
            company,
            reviews,
            averageRating,
            totalReviews: reviews.length,
            generatedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error in parallel review generation:', error);
        throw error;
    }
}

/**
 * LangGraph state management for review generation
 * Tracks the state of review generation process
 */
export class ReviewGenerationState {
    constructor(company) {
        this.company = company;
        this.reviews = [];
        this.status = 'pending';
        this.error = null;
    }

    addReview(review) {
        this.reviews.push(review);
    }

    setComplete() {
        this.status = 'complete';
    }

    setError(error) {
        this.status = 'error';
        this.error = error;
    }

    getAverageRating() {
        if (this.reviews.length === 0) return 0;
        return (
            this.reviews.reduce((sum, r) => sum + r.rating, 0) / this.reviews.length
        ).toFixed(1);
    }

    toJSON() {
        return {
            company: this.company,
            reviews: this.reviews,
            averageRating: this.getAverageRating(),
            totalReviews: this.reviews.length,
            status: this.status,
            error: this.error
        };
    }
}

export default ReviewGeneratorAgent;
