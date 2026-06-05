# Proxy Server Setup Guide

This guide will help you set up the Express proxy server to handle Claude API calls and avoid CORS issues.

## Step 1: Install Dependencies

Run this command in your project root:

```bash
npm install express cors @anthropic-ai/sdk dotenv concurrently --save
```

## Step 2: Create .env File

Create a `.env` file in the **root** of your project (same level as `package.json`):

```env
# Anthropic API Key (server-side only)
# Get your key from: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Optional: Custom port for proxy server (default: 3001)
# PORT=3001
```

**Important:** 
- Replace `sk-ant-your-key-here` with your actual API key from https://console.anthropic.com/
- Do NOT add `VITE_` prefix - this is server-side only
- Make sure `.env` is in your `.gitignore` file (it should be by default)

## Step 3: Start the Development Servers

Now you can start both the proxy server and the frontend together:

```bash
npm run dev
```

This will:
- Start the proxy server on `http://localhost:3001`
- Start the Vite dev server on `http://localhost:5173`

You should see output like:
```
🚀 Proxy server running on http://localhost:3001
📡 Forwarding Claude API requests...
VITE v7.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

## Step 4: Verify It Works

1. Open your app in the browser: `http://localhost:5173`
2. Go to Settings → AI Settings
3. Click "Test Connection"
4. You should see "Connection successful! Your API key is working."

## How It Works

- **Frontend** (browser) → Makes requests to `http://localhost:3001/api/claude`
- **Proxy Server** → Receives request, adds API key from `.env`, forwards to Anthropic API
- **Anthropic API** → Returns response to proxy server
- **Proxy Server** → Returns response to frontend

This avoids CORS issues because:
- The browser only talks to `localhost:3001` (same origin)
- The proxy server (Node.js) can make requests to any API without CORS restrictions

## Troubleshooting

### "Failed to connect to proxy server"
- Make sure you ran `npm run dev` (not just `npm run client`)
- Check that the proxy server is running on port 3001
- Look for errors in the terminal where you ran `npm run dev`

### "Invalid API key"
- Check your `.env` file has `ANTHROPIC_API_KEY=sk-ant-...`
- Make sure there are no extra spaces or quotes
- Verify your API key at https://console.anthropic.com/

### Port Already in Use
- If port 3001 is taken, change it in `.env`: `PORT=3002`
- Update `PROXY_URL` in `src/utils/claudeClient.ts` to match

## Running Servers Separately

If you need to run them separately:

```bash
# Terminal 1: Proxy server
npm run server

# Terminal 2: Frontend
npm run client
```

## Production Deployment

For production, you'll need to:
1. Deploy the proxy server separately (e.g., on Heroku, Railway, or a VPS)
2. Update `PROXY_URL` in `src/utils/claudeClient.ts` to point to your production proxy URL
3. Set the `ANTHROPIC_API_KEY` environment variable on your production server
