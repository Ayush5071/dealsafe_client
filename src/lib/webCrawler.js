import axios from 'axios';
import * as cheerio from 'cheerio';
import { ollamaClient } from './llm';

/**
 * LangGraph-powered Web Crawler for Contract Clause Research
 * Replaces Firecrawl with a custom implementation
 */

// LangGraph State for Crawler Workflow
class CrawlerState {
    constructor(query) {
        this.query = query;
        this.searchResults = [];
        this.scrapedContent = [];
        this.relevantClauses = [];
        this.status = 'pending';
        this.error = null;
    }
}

/**
 * Search Agent - Finds relevant URLs
 */
class SearchAgent {
    async execute(state) {
        console.log(`[SearchAgent] Searching for: ${state.query}`);

        // Use DuckDuckGo HTML search (no API key needed)
        const searchQuery = encodeURIComponent(`${state.query} contract clause legal`);
        const searchUrl = `https://html.duckduckgo.com/html/?q=${searchQuery}`;

        try {
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            const results = [];

            // Extract search result links
            $('.result__a').each((i, elem) => {
                if (i < 5) { // Limit to top 5 results
                    const url = $(elem).attr('href');
                    const title = $(elem).text();
                    if (url && !url.includes('duckduckgo.com')) {
                        results.push({ url, title });
                    }
                }
            });

            state.searchResults = results;
            console.log(`[SearchAgent] Found ${results.length} results`);
            return state;
        } catch (error) {
            console.error('[SearchAgent] Error:', error.message);
            state.error = error.message;
            return state;
        }
    }
}

/**
 * Scraper Agent - Extracts content from URLs
 */
class ScraperAgent {
    async execute(state) {
        console.log(`[ScraperAgent] Scraping ${state.searchResults.length} URLs`);

        const scrapedContent = [];

        // Scrape URLs in parallel
        const scrapePromises = state.searchResults.map(async (result) => {
            try {
                const response = await axios.get(result.url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 8000,
                    maxContentLength: 500000 // Limit to 500KB
                });

                const $ = cheerio.load(response.data);

                // Remove scripts, styles, and navigation
                $('script, style, nav, header, footer, iframe').remove();

                // Extract main content
                let content = '';
                $('article, main, .content, .article-body, p').each((i, elem) => {
                    content += $(elem).text() + ' ';
                });

                // Clean up whitespace
                content = content.replace(/\s+/g, ' ').trim();

                if (content.length > 100) {
                    scrapedContent.push({
                        url: result.url,
                        title: result.title,
                        content: content.substring(0, 2000) // Limit content length
                    });
                }
            } catch (error) {
                console.warn(`[ScraperAgent] Failed to scrape ${result.url}:`, error.message);
            }
        });

        await Promise.all(scrapePromises);

        state.scrapedContent = scrapedContent;
        console.log(`[ScraperAgent] Successfully scraped ${scrapedContent.length} pages`);
        return state;
    }
}

/**
 * Relevance Filter Agent - Uses Qwen to filter relevant clauses
 */
class RelevanceFilterAgent {
    async execute(state) {
        console.log(`[RelevanceFilterAgent] Filtering ${state.scrapedContent.length} pages`);

        const relevantClauses = [];

        for (const page of state.scrapedContent) {
            try {
                const prompt = `Analyze the following web content and extract any contract clauses or legal information related to: "${state.query}"

WEB CONTENT:
${page.content}

Extract ONLY relevant contract clauses or legal terms. Return a JSON object with:
{
  "relevant": true/false,
  "clauses": ["clause 1", "clause 2"],
  "summary": "brief summary"
}

Respond with ONLY the JSON object.`;

                const response = await ollamaClient.chat(
                    [{ role: 'user', content: prompt }],
                    'You are a legal expert extracting contract clauses from web content.'
                );

                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const result = JSON.parse(jsonMatch[0]);

                    if (result.relevant && result.clauses && result.clauses.length > 0) {
                        relevantClauses.push({
                            source: page.url,
                            title: page.title,
                            clauses: result.clauses,
                            summary: result.summary,
                            confidence: 0.7
                        });
                    }
                }
            } catch (error) {
                console.warn(`[RelevanceFilterAgent] Error processing ${page.url}:`, error.message);
            }
        }

        state.relevantClauses = relevantClauses;
        state.status = 'complete';
        console.log(`[RelevanceFilterAgent] Found ${relevantClauses.length} relevant results`);
        return state;
    }
}

/**
 * LangGraph Workflow Orchestrator
 */
export class CrawlerWorkflow {
    constructor() {
        this.searchAgent = new SearchAgent();
        this.scraperAgent = new ScraperAgent();
        this.relevanceFilterAgent = new RelevanceFilterAgent();
    }

    async execute(query) {
        console.log(`[CrawlerWorkflow] Starting workflow for: ${query}`);

        // Initialize state
        let state = new CrawlerState(query);

        try {
            // Step 1: Search for URLs
            state = await this.searchAgent.execute(state);

            if (state.searchResults.length === 0) {
                console.warn('[CrawlerWorkflow] No search results found');
                return [];
            }

            // Step 2: Scrape content (parallel)
            state = await this.scraperAgent.execute(state);

            if (state.scrapedContent.length === 0) {
                console.warn('[CrawlerWorkflow] No content scraped');
                return [];
            }

            // Step 3: Filter relevant clauses using AI
            state = await this.relevanceFilterAgent.execute(state);

            console.log(`[CrawlerWorkflow] Workflow complete. Found ${state.relevantClauses.length} relevant clauses`);
            return state.relevantClauses;

        } catch (error) {
            console.error('[CrawlerWorkflow] Workflow error:', error);
            return [];
        }
    }
}

// Export singleton instance
export const crawlerWorkflow = new CrawlerWorkflow();

// Legacy compatibility function
export async function scrapeRelatedClauses(contractText) {
    // Extract key terms from contract for search
    const searchQuery = contractText.substring(0, 200).replace(/\s+/g, ' ').trim();

    return await crawlerWorkflow.execute(searchQuery);
}
