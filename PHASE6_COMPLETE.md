# Phase 6: ML-Powered Features - Complete ✅

## Overview

Phase 6 adds Anthropic Claude API integration for intelligent research assistance. All AI features are optional and gracefully degrade if the API key is not configured.

## Features Implemented

### 6.1 API Setup ✅

**File**: `src/utils/anthropic.ts`

- **Anthropic Client**: Singleton client with API key management
- **Key Management**: 
  - `setApiKey()` - Save API key to localStorage
  - `hasApiKey()` - Check if key exists
  - `removeApiKey()` - Remove key
  - `getAnthropicClient()` - Get configured client instance

- **Usage Tracking**:
  - `getUsage()` - Get API call and token usage statistics
  - `incrementUsage()` - Track API calls and tokens
  - `resetUsage()` - Reset statistics

### 6.2 Smart Theme Suggestions ✅

**Component**: `src/components/ai/ThemeSuggestions.tsx`

- **Integration Points**:
  - Notes page (when editing/creating notes)
  - Sources page (in SourceForm)
  - Interviews page (when editing transcripts)

- **Features**:
  - "Suggest Themes" button appears when API key is configured
  - Sends content to Claude with academic research analysis prompt
  - Returns 3-5 relevant theme suggestions
  - Clickable tags for selection
  - Accept/reject/edit functionality
  - "Powered by Claude" badge
  - Loading states with spinner

- **Usage**:
  ```tsx
  <ThemeSuggestions
    content={noteContent}
    onAccept={(themes) => setTags([...tags, ...themes])}
    existingTags={currentTags}
  />
  ```

### 6.3 Semantic Search Enhancement ✅

**File**: `src/pages/Search.tsx`

- **Toggle**: Checkbox to enable "Semantic Search" mode
- **Features**:
  - When enabled, uses Claude to understand query intent
  - Reranks results by semantic relevance
  - Shows relevance explanations for each result
  - Falls back to keyword search if API fails
  - Only appears when API key is configured

- **How It Works**:
  1. Collects all content from sources, notes, interviews
  2. Sends to Claude with query for semantic matching
  3. Receives ranked results with relevance explanations
  4. Displays results with relevance notes
  5. Falls back gracefully on error

### 6.4 Content Summarization ✅

**Function**: `summarizeContent()` in `src/utils/anthropic.ts`

- **Integration Points**:
  - Notes: "Summarize" button creates new note with summary
  - Interviews: "Summarize" button generates summary of transcript

- **Output Format**:
  - Concise summary (2-3 paragraphs)
  - Key points (5-7 bullet items)
  - Notable quotes (3-5 short quotes)

- **Features**:
  - Context-aware (handles transcripts, sources, notes differently)
  - Creates new note with summary for Notes
  - Shows summary in alert for Interviews (can be enhanced)
  - Word count savings displayed

### 6.5 Error Handling ✅

- **Graceful Degradation**:
  - All AI features check for API key before showing
  - Features hidden if no API key
  - Clear error messages if API calls fail
  - Automatic fallback to keyword search

- **Error Messages**:
  - "API key not configured" - when trying to use without key
  - "Failed to suggest themes" - theme suggestion errors
  - "Semantic search failed, falling back to keyword search" - search errors
  - "Failed to generate summary" - summarization errors

### 6.6 UI Additions ✅

**Settings Page** (`src/pages/Settings.tsx`):
- **API Key Management**:
  - Input field for API key (password masked)
  - Show/hide toggle
  - Save/Remove buttons
  - Link to Anthropic Console

- **Usage Statistics**:
  - API calls counter
  - Token usage counter
  - Reset statistics button
  - Only shown when API key is configured

**AI Components**:
- **AIButton** (`src/components/ai/AIButton.tsx`):
  - Reusable button with loading states
  - Only shows when API key exists
  - Sparkle emoji indicator (✨)

- **ThemeSuggestions**:
  - "Powered by Claude" badge
  - Loading spinner
  - Clickable tag selection
  - Accept/Cancel buttons

**Search Page**:
- Semantic search toggle checkbox
- "Powered by Claude" indicator
- Relevance explanations on results

## API Functions

### `suggestThemes(content: string): Promise<string[]>`
Analyzes content and returns 3-5 theme suggestions.

### `semanticSearch(query: string, items: Array): Promise<Array>`
Performs semantic search and returns ranked results with relevance.

### `summarizeContent(content: string, type: string): Promise<Object>`
Generates summary with key points and quotes.

## Usage Tracking

- Tracks API calls and tokens used
- Stored in localStorage
- Displayed in Settings
- Can be reset

## Security

- API key stored in localStorage (client-side only)
- Never sent to any server except Anthropic
- Can be removed at any time
- No key = no AI features (graceful degradation)

## Installation

After adding the package, run:
```bash
npm install
```

The `@anthropic-ai/sdk` package is already added to `package.json`.

## Getting Your API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)
6. Paste it in Settings → AI Settings

## Cost Considerations

- Claude API charges per token (input + output)
- Usage is tracked in Settings
- Typical costs:
  - Theme suggestions: ~500-1000 tokens per call
  - Semantic search: ~2000-5000 tokens per call
  - Summarization: ~2000-4000 tokens per call

## Future Enhancements

Potential improvements:
- Batch processing for multiple items
- Caching of AI results
- More sophisticated prompt engineering
- Custom prompt templates
- Export AI-generated summaries
- AI-powered citation formatting
- Auto-tagging based on content

## Summary

Phase 6 is complete! The application now has:
- ✅ Full Claude API integration
- ✅ Smart theme suggestions
- ✅ Semantic search
- ✅ Content summarization
- ✅ Usage tracking
- ✅ Graceful error handling
- ✅ Beautiful UI with badges and indicators

All features work without AI (optional enhancement), and the app is fully functional even without an API key.
