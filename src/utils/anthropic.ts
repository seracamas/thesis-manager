/**
 * Anthropic Claude API utilities
 * 
 * All API calls are routed through the Express proxy server (server/index.js)
 * to avoid CORS issues when calling from the browser.
 */

import { callClaude, askClaude, getUsageFromResponse, type ClaudeResponse } from './claudeClient';

/**
 * API Key Management
 * 
 * The Anthropic API key is stored in the browser's localStorage.
 * This is a client-side only storage mechanism that:
 * - Persists across browser sessions
 * - Never leaves the user's device (secure)
 * - Is accessible only to this application
 * 
 * Storage key: 'anthropic-api-key'
 * Location: Browser localStorage (client-side only)
 * 
 * NOTE: The actual API key is now stored server-side in .env file.
 * The localStorage key is kept for UI state management only.
 */

/**
 * Check if an API key is stored (for UI purposes)
 */
export function hasApiKey(): boolean {
  return !!localStorage.getItem('anthropic-api-key');
}

/**
 * Save the API key to localStorage (for UI state only)
 * The actual API key should be in server .env file
 * @param key - The Anthropic API key (should start with 'sk-ant-')
 */
export function setApiKey(key: string): void {
  localStorage.setItem('anthropic-api-key', key);
  console.log('API key saved to localStorage (UI state only - actual key should be in server .env)');
}

/**
 * Remove the API key from localStorage
 */
export function removeApiKey(): void {
  localStorage.removeItem('anthropic-api-key');
  console.log('API key removed from localStorage');
}

/**
 * Get the stored API key (for debugging/admin purposes)
 * Note: This should be used carefully and never exposed in logs or UI
 */
export function getApiKey(): string | null {
  return localStorage.getItem('anthropic-api-key');
}

export interface AIUsage {
  calls: number;
  tokens: number;
}

const USAGE_KEY = 'anthropic-usage';

export function getUsage(): AIUsage {
  const stored = localStorage.getItem(USAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return { calls: 0, tokens: 0 };
}

export function incrementUsage(tokens: number = 0): void {
  const usage = getUsage();
  usage.calls += 1;
  usage.tokens += tokens;
  localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
}

export function resetUsage(): void {
  localStorage.setItem(USAGE_KEY, JSON.stringify({ calls: 0, tokens: 0 }));
}

/**
 * Suggest themes from content using Claude API
 */
export async function suggestThemes(content: string): Promise<string[]> {
  const prompt = `Analyze this academic research content and suggest 3-5 relevant themes or codes for qualitative analysis. Return only a JSON array of theme names, nothing else.

Content:
${content.substring(0, 8000)}`;

  try {
    const response = await callClaude({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
      model: 'claude-sonnet-4-6',
    });

    const usage = getUsageFromResponse(response);
    incrementUsage(usage.inputTokens + usage.outputTokens);

    if (response.content && response.content.length > 0 && response.content[0].type === 'text') {
      let text = response.content[0].text.trim();
      
      // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
      text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      
      // Try to extract JSON from text if it's wrapped in other content
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        text = jsonMatch[0];
      }
      
      // Try to parse as JSON array
      try {
        const themes = JSON.parse(text);
        if (Array.isArray(themes)) {
          return themes.filter((t) => typeof t === 'string').slice(0, 5);
        }
      } catch {
        // If not JSON, try to extract themes from text
        const lines = text.split('\n').filter((line: string) => line.trim());
        const themes = lines
          .map((line: string) => line.replace(/^[-•\d.]+\s*/, '').trim())
          .filter((t: string) => t.length > 0 && !t.startsWith('[') && !t.startsWith(']') && !t.startsWith('```'))
          .slice(0, 5);
        return themes;
      }
    }
    
    return [];
  } catch (error: any) {
    console.error('Error suggesting themes:', error);
    
    // Provide helpful error messages
    if (error.message?.includes('connect to proxy server')) {
      throw new Error('Proxy server not running. Make sure to run: npm run dev (this starts both the server and client)');
    }
    
    if (error.message?.includes('401') || error.message?.includes('authentication')) {
      throw new Error('Invalid API key. Please check your API key in the server .env file (ANTHROPIC_API_KEY).');
    }
    
    if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    }
    
    throw new Error(error.message || 'Failed to suggest themes. Please try again.');
  }
}

/**
 * Semantic search using Claude API
 */
export async function semanticSearch(
  query: string,
  contentItems: Array<{ id: string; content: string; title?: string }>
): Promise<Array<{ id: string; relevance: string }>> {
  const contentSummary = contentItems
    .map((item, idx) => `[${idx}] ${item.title || 'Item'}: ${item.content.substring(0, 500)}`)
    .join('\n\n');

  const prompt = `Find content related to "${query}" in this research database. Return a JSON array of objects with "index" (0-based) and "relevance" (brief explanation) for the top 10 most relevant items.

Query: ${query}

Content:
${contentSummary.substring(0, 15000)}`;

  try {
    const response = await callClaude({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
      model: 'claude-sonnet-4-6',
    });

    const usage = getUsageFromResponse(response);
    incrementUsage(usage.inputTokens + usage.outputTokens);

    if (response.content && response.content.length > 0 && response.content[0].type === 'text') {
      const text = response.content[0].text.trim();
      try {
        const results = JSON.parse(text);
        if (Array.isArray(results)) {
          return results.map((r: any) => ({
            id: contentItems[r.index]?.id || '',
            relevance: r.relevance || '',
          }));
        }
      } catch {
        // Fallback: return empty array if parsing fails
        return [];
      }
    }
    
    return [];
  } catch (error: any) {
    console.error('Error in semantic search:', error);
    
    if (error.message?.includes('connect to proxy server')) {
      throw new Error('Proxy server not running. Make sure to run: npm run dev');
    }
    
    throw new Error(error.message || 'Failed to perform semantic search. Please try again.');
  }
}

/**
 * Summarize content using Claude API
 */
export async function summarizeContent(
  content: string,
  contentType: 'transcript' | 'source' | 'notes' = 'source'
): Promise<{
  summary: string;
  keyPoints: string[];
  quotes: string[];
}> {
  const typePrompt =
    contentType === 'transcript'
      ? 'interview transcript'
      : contentType === 'notes'
      ? 'research notes'
      : 'academic source';

  const prompt =
    contentType === 'source'
      ? `Summarize this academic source in 2-3 sentences for a research context. Focus on the main argument, methodology, and relevance.

Return as JSON:
{
  "summary": "2-3 sentence summary focusing on main argument, methodology, and relevance",
  "keyPoints": ["...", "..."],
  "quotes": ["...", "..."]
}

Content:
${content.substring(0, 100000)}`
      : `Summarize this ${typePrompt}. Provide:
1. A concise summary (2-3 paragraphs)
2. Key points (bullet list, 5-7 items)
3. Notable quotes (3-5 short quotes)

Return as JSON:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "quotes": ["...", "..."]
}

Content:
${content.substring(0, 100000)}`;

  try {
    const response = await callClaude({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
      model: 'claude-sonnet-4-6',
    });

    const usage = getUsageFromResponse(response);
    incrementUsage(usage.inputTokens + usage.outputTokens);

    if (response.content && response.content.length > 0 && response.content[0].type === 'text') {
      const text = response.content[0].text.trim();
      try {
        const result = JSON.parse(text);
        return {
          summary: result.summary || '',
          keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints : [],
          quotes: Array.isArray(result.quotes) ? result.quotes : [],
        };
      } catch {
        // Fallback: use text as summary
        return {
          summary: text,
          keyPoints: [],
          quotes: [],
        };
      }
    }
    
    return { summary: '', keyPoints: [], quotes: [] };
  } catch (error: any) {
    console.error('Error summarizing content:', error);
    
    if (error.message?.includes('connect to proxy server')) {
      throw new Error('Proxy server not running. Make sure to run: npm run dev');
    }
    
    if (error.message?.includes('401') || error.message?.includes('authentication')) {
      throw new Error('Invalid API key. Please check your API key in the server .env file (ANTHROPIC_API_KEY).');
    }
    
    throw new Error(error.message || 'Failed to summarize content. Please try again.');
  }
}

/**
 * Extract information from webpage using Claude API
 * Used for citation parsing
 */
export async function extractInfoWithClaude(webpageContent: string, url: string): Promise<{
  title: string;
  authors: string[];
  date: string;
  journal?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  abstract?: string;
  type: string;
}> {
  const prompt = `You are a metadata extractor for academic sources. From the following webpage content, extract:
- title (the article or paper title, not the website name)
- authors (full names as they appear)
- year (publication year)
- journal or publisher name
- volume, issue, pages if present
- DOI if present
- abstract or main summary if present
- type (determine if this is an article, book, website, thesis, conference paper, or other)

Return ONLY a JSON object with these fields. If a field is not found, return null for that field.

Webpage content: ${webpageContent.substring(0, 100000)}`;

  try {
    const response = await callClaude({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
      model: 'claude-sonnet-4-6',
    });

    const usage = getUsageFromResponse(response);
    incrementUsage(usage.inputTokens + usage.outputTokens);

    if (response.content && response.content.length > 0 && response.content[0].type === 'text') {
      const text = response.content[0].text.trim();
      
      // Try to extract JSON from the response
      let jsonText = text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      try {
        const data = JSON.parse(jsonText);
        
        // Convert date format if needed
        let dateStr = data.year ? `${data.year}-01-01` : '';
        if (data.date && !dateStr) {
          const yearMatch = String(data.date).match(/\b(19|20)\d{2}\b/);
          if (yearMatch) {
            dateStr = `${yearMatch[0]}-01-01`;
          }
        }

        return {
          title: data.title || '',
          authors: Array.isArray(data.authors) ? data.authors : [],
          date: dateStr,
          journal: data.journal || undefined,
          publisher: data.publisher || undefined,
          volume: data.volume || undefined,
          issue: data.issue || undefined,
          pages: data.pages || undefined,
          doi: data.doi || undefined,
          abstract: data.abstract || undefined,
          type: data.type || 'website',
        };
      } catch (parseError) {
        console.error('Failed to parse Claude response as JSON:', parseError);
        throw new Error('Claude returned invalid response format');
      }
    }
    
    throw new Error('No text response from Claude');
  } catch (error: any) {
    console.error('Claude extraction error:', error);
    
    if (error.message?.includes('connect to proxy server')) {
      throw new Error('Proxy server not running. Make sure to run: npm run dev');
    }
    
    throw error;
  }
}
