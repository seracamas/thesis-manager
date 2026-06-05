/**
 * Claude API Client via Proxy Server
 * 
 * All Claude API calls are routed through the Express proxy server
 * to avoid CORS issues when calling from the browser.
 */

const PROXY_URL = '/api/claude';
const API_KEY_STORAGE_KEY = 'anthropic-api-key';

export function getProxyHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const apiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  return headers;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ClaudeRequest {
  messages: ClaudeMessage[];
  system?: string;
  max_tokens?: number;
  model?: string;
}

export interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Make a request to Claude API via the proxy server
 */
export async function callClaude(request: ClaudeRequest): Promise<ClaudeResponse> {
  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: getProxyHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data: ClaudeResponse = await response.json();
    return data;
  } catch (error: any) {
    console.error('[Claude Client] Request failed:', error);
    
    // Check for network errors
    if (error.message?.includes('fetch') || error.message?.includes('network') || error.name === 'TypeError') {
      throw new Error('Failed to connect to proxy server. Make sure the server is running on port 3001. Run: npm run dev');
    }
    
    // Check if we got an error response from the server
    if (error.status || error.statusCode) {
      const status = error.status || error.statusCode;
      const errorMessage = error.error || error.message || 'Unknown error';
      
      // 401 = authentication error
      if (status === 401 || errorMessage.includes('401') || errorMessage.includes('authentication')) {
        throw new Error('Invalid API key. Please check your API key in the server .env file (ANTHROPIC_API_KEY). Get a new key at https://console.anthropic.com/');
      }
      
      throw new Error(errorMessage);
    }
    
    throw error;
  }
}

/**
 * Simplified function to ask Claude a question
 */
export async function askClaude(
  prompt: string,
  systemPrompt?: string,
  maxTokens: number = 1000,
  model: string = 'claude-sonnet-4-6'
): Promise<string> {
  const response = await callClaude({
    messages: [{ role: 'user', content: prompt }],
    system: systemPrompt,
    max_tokens: maxTokens,
    model,
  });

  if (response.content && response.content.length > 0 && response.content[0].type === 'text') {
    return response.content[0].text;
  }

  throw new Error('Unexpected response format from Claude API');
}

/**
 * Get usage statistics from a Claude response
 */
export function getUsageFromResponse(response: ClaudeResponse): { inputTokens: number; outputTokens: number } {
  return {
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
  };
}
