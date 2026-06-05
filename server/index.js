import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from project root (one level up from server/)
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
app.use(cors({
  origin(origin, callback) {
    if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '10mb' }));

function resolveApiKey(req) {
  const requestKey = req.get('x-api-key');
  if (requestKey) {
    return requestKey;
  }

  return process.env.ANTHROPIC_API_KEY || null;
}

function createAnthropicClient(apiKey) {
  return new Anthropic({ apiKey });
}

function getApiKeyError() {
  return 'Anthropic API key not configured. Add ANTHROPIC_API_KEY to .env or save your key in Settings -> AI Settings.';
}

const envApiKey = process.env.ANTHROPIC_API_KEY;
if (envApiKey?.startsWith('sk-ant-')) {
  console.log('✅ API key loaded from .env (length:', envApiKey.length, ')');
} else if (envApiKey) {
  console.warn('⚠️  ANTHROPIC_API_KEY in .env has an unexpected format. Keys should start with "sk-ant-".');
} else {
  console.warn('⚠️  No ANTHROPIC_API_KEY in .env. The proxy will use keys saved in Settings.');
}

app.post('/api/analyze-interviews', async (req, res) => {
  try {
    const apiKey = resolveApiKey(req);
    if (!apiKey?.startsWith('sk-ant-')) {
      return res.status(401).json({ error: getApiKeyError() });
    }

    const anthropic = createAnthropicClient(apiKey);
    const { userPrompt, interviewData, themeOccurrences } = req.body;

    if (!userPrompt) {
      return res.status(400).json({ error: 'userPrompt is required' });
    }

    if (!interviewData || !Array.isArray(interviewData)) {
      return res.status(400).json({ error: 'interviewData array is required' });
    }

    if (!themeOccurrences || !Array.isArray(themeOccurrences)) {
      return res.status(400).json({ error: 'themeOccurrences array is required' });
    }

    const systemPrompt = `You are a qualitative research data analyst. You receive interview data and theme occurrences from a thesis research tool. Based on the user's request, analyze the data and return a JSON object describing a chart to visualize the findings.

Return ONLY a JSON object in this format:
{
  "chartType": "bar" | "pie" | "line" | "radar" | "scatter",
  "title": "string",
  "description": "1-2 sentence insight about what the data shows",
  "data": [{"name": "string", "value": number, ...}],
  "xAxisLabel": "optional string",
  "yAxisLabel": "optional string",
  "colors": ["optional", "color", "array"]
}

Base your analysis on the actual data provided. Count occurrences, identify patterns, compare across interviews. Be accurate.`;

    const userMessage = `User request: ${userPrompt}

Interview data:
${JSON.stringify(interviewData, null, 2)}

Theme occurrences:
${JSON.stringify(themeOccurrences, null, 2)}

Analyze this data and return a JSON chart specification.`;

    console.log(`📊 Analyzing interviews for: "${userPrompt}"`);

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    if (!response.content || response.content.length === 0) {
      throw new Error('No response from Claude');
    }

    const textContent = response.content[0].type === 'text' ? response.content[0].text : '';
    
    // Extract JSON from response (handle code blocks)
    let jsonText = textContent.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.substring(7);
    }
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.substring(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.substring(0, jsonText.length - 3);
    }
    jsonText = jsonText.trim();

    const chartSpec = JSON.parse(jsonText);

    console.log('✅ Chart spec generated successfully');
    res.json(chartSpec);
  } catch (error) {
    console.error('❌ Error analyzing interviews:', error);
    const errorMessage = error?.message || 'Unknown error';
    res.status(500).json({ 
      error: `Failed to analyze interviews: ${errorMessage}`,
    });
  }
});

app.post('/api/claude', async (req, res) => {
  try {
    const apiKey = resolveApiKey(req);
    if (!apiKey?.startsWith('sk-ant-')) {
      return res.status(401).json({ error: getApiKeyError() });
    }

    const anthropic = createAnthropicClient(apiKey);
    const { messages, system, max_tokens = 1024 } = req.body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Hardcoded model - cannot be overridden by frontend
    const model = 'claude-haiku-4-5-20251001';
    
    console.log(`📤 Making Claude API request (model: ${model}, tokens: ${max_tokens || 1024})`);
    
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: max_tokens || 1024,
      system,
      messages,
    });
    
    console.log('✅ Claude API request successful');
    res.json(response);
  } catch (error) {
    console.error('❌ Claude API error:', error);
    
    // Safely extract error information
    const errorMessage = error?.message || error?.error?.message || 'Unknown error';
    const statusCode = error?.status || error?.statusCode || error?.error?.status || 500;
    const errorType = error?.error?.type || error?.type || 'unknown_error';
    
    console.error('Error details:', {
      message: errorMessage,
      status: statusCode,
      type: errorType,
    });
    
    // Make sure statusCode is a valid HTTP status code
    const httpStatus = (statusCode >= 100 && statusCode < 600) ? statusCode : 500;
    
    res.status(httpStatus).json({ 
      error: errorMessage,
      status: httpStatus,
      type: errorType,
    });
  }
});

const PORT = process.env.PORT || 3001;

// Add error handler for unhandled errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server with error handling
try {
  app.listen(PORT, () => {
    console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
    console.log(`📡 Forwarding Claude API requests...`);
  });
} catch (error) {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
}
