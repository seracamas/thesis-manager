import { callClaude } from './claudeClient';

/**
 * Test the Claude API connection via proxy server
 */
export async function testClaudeConnection(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('[Test Connection] Testing Claude API connection via proxy...');
    
    // Make a simple test request
    const response = await callClaude({
      messages: [{ role: 'user', content: 'Say "test"' }],
      max_tokens: 10,
      model: 'claude-sonnet-4-6',
    });

    console.log('[Test Connection] API call successful!', {
      hasResponse: !!response,
      hasContent: !!response?.content,
      contentLength: response?.content?.length,
    });

    if (response && response.content && response.content.length > 0) {
      return {
        success: true,
        message: 'Connection successful! Your API key is working.',
      };
    }

    return {
      success: false,
      message: 'Unexpected response from API',
    };
  } catch (error: any) {
    console.error('[Test Connection] Error caught:', error);
    console.error('[Test Connection] Full error details:', {
      name: error?.name,
      message: error?.message,
    });
    
    // Check for proxy server connection errors
    if (error.message?.includes('connect to proxy server') || 
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('network') ||
        error.name === 'TypeError') {
      return {
        success: false,
        message: 'Failed to connect to proxy server. Make sure:\n1. The server is running (npm run dev)\n2. The server is on port 3001\n3. Check the server console for errors',
      };
    }
    
    // Check for authentication errors
    if (error.message?.includes('401') || 
        error.message?.includes('authentication') ||
        error.message?.includes('Invalid API key')) {
      return {
        success: false,
        message: 'Invalid API key. Please check your API key in the server .env file (ANTHROPIC_API_KEY). Get a new key at https://console.anthropic.com/',
      };
    }
    
    // Check for rate limit errors
    if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      return {
        success: false,
        message: 'Rate limit exceeded. Please wait a moment and try again.',
      };
    }
    
    // Generic error
    return {
      success: false,
      message: error?.message || 'Connection test failed. Please check your API key and server connection.',
    };
  }
}
