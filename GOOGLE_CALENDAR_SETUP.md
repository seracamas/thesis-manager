# Google Calendar API Setup Guide

Follow these steps to get your Google Calendar API credentials and enable the Planning features.

## Step 1: Go to Google Cloud Console

1. Visit: https://console.cloud.google.com/
2. Sign in with your Google account (use the same account you want to connect to Calendar)

## Step 2: Create a New Project (or Select Existing)

1. Click the project dropdown at the top (next to "Google Cloud")
2. Click **"New Project"**
3. Enter a project name (e.g., "Thesis Research Manager")
4. Click **"Create"**
5. Wait for the project to be created, then select it from the dropdown

## Step 3: Enable Google Calendar API

1. In the left sidebar, go to **"APIs & Services"** → **"Library"**
2. In the search bar, type: **"Google Calendar API"**
3. Click on **"Google Calendar API"**
4. Click the **"Enable"** button
5. Wait for it to enable (may take a few seconds)

## Step 4: Create OAuth 2.0 Credentials

1. In the left sidebar, go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"OAuth client ID"**

### If you see "Configure consent screen" first:
1. Click **"Configure consent screen"**
2. Select **"External"** (unless you have a Google Workspace account)
3. Click **"Create"**
4. Fill in the required fields:
   - **App name**: "Thesis Research Manager" (or any name)
   - **User support email**: Your email
   - **Developer contact information**: Your email
5. Click **"Save and Continue"**
6. On "Scopes" page, click **"Save and Continue"** (no need to add scopes here)
7. On "Test users" page, click **"Save and Continue"** (you can add your email if you want)
8. Click **"Back to Dashboard"**

### Now create the OAuth Client ID:
1. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
2. Select **"Web application"** as the application type
3. Give it a name: "Thesis Research Manager Web Client"
4. **Authorized JavaScript origins**:
   - Click **"+ ADD URI"**
   - Add: `http://localhost:5173` (for development)
   - If deploying, also add your production URL (e.g., `https://your-app.vercel.app`)
5. **Authorized redirect URIs**:
   - Click **"+ ADD URI"**
   - Add: `http://localhost:5173` (for development)
   - If deploying, also add your production URL
6. Click **"Create"**

## Step 5: Copy Your Client ID

1. A popup will appear with your **Client ID** and **Client Secret**
2. **Copy the Client ID** (it looks like: `123456789-abcdefghijklmnop.apps.googleusercontent.com`)
3. You can close this popup (you don't need the Client Secret for this setup)

## Step 6: Add to Your Project

1. In your project root folder, create a file named `.env` (if it doesn't exist)
2. Add this line:
   ```
   VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
   ```
3. Replace `your-client-id-here.apps.googleusercontent.com` with the Client ID you copied
4. Save the file

## Step 7: Restart Your Dev Server

1. Stop your dev server (Ctrl+C in terminal)
2. Start it again:
   ```bash
   npm run dev
   ```

## Step 8: Test the Connection

1. Go to the **Planning** tab in your app
2. Click **"Connect Google Calendar"**
3. A popup will open asking you to sign in with Google
4. Sign in and authorize the app
5. You should see "✓ Connected to Google Calendar" message

## Troubleshooting

### "Invalid client" error:
- Make sure you copied the Client ID correctly
- Check that `http://localhost:5173` is in your Authorized JavaScript origins
- Make sure the `.env` file is in the project root (same folder as `package.json`)
- Restart your dev server after adding the `.env` file

### "Redirect URI mismatch" error:
- Make sure `http://localhost:5173` is in your Authorized redirect URIs
- Check that you're accessing the app at `http://localhost:5173` (not a different port)

### Can't find the .env file:
- Make sure it's in the root folder (same level as `package.json`)
- Make sure it's named exactly `.env` (with the dot at the beginning)
- On Mac/Linux, hidden files (starting with `.`) might not show in Finder. Use a code editor to create it.

### API not enabled:
- Go back to APIs & Services → Library
- Search for "Google Calendar API"
- Make sure it shows "Enabled" (green checkmark)

## For Production Deployment

When deploying to Vercel/Netlify:

1. Go to your hosting platform's environment variables settings
2. Add: `VITE_GOOGLE_CLIENT_ID` = `your-client-id-here`
3. In Google Cloud Console, add your production URL to:
   - Authorized JavaScript origins
   - Authorized redirect URIs
4. Redeploy your app

## Security Note

- Never commit your `.env` file to git (it should already be in `.gitignore`)
- The Client ID is safe to expose in frontend code (it's public)
- You don't need the Client Secret for this OAuth flow
