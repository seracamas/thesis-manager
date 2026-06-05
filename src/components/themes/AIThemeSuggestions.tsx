import { useState } from 'react';
import { useThemesStore } from '../../stores/themesStore';
import { useThemeOccurrencesStore } from '../../stores/themeOccurrencesStore';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useToastStore } from '../../stores/toastStore';
import { callClaude, getUsageFromResponse } from '../../utils/claudeClient';
import { incrementUsage } from '../../utils/anthropic';

interface AIThemeSuggestionsProps {
  transcript: string;
  interviewId: string;
  interviewTitle: string;
  onComplete?: () => void;
}

interface SuggestedTheme {
  name: string;
  description: string;
  quotes: string[];
}

export const AIThemeSuggestions = ({
  transcript,
  interviewId,
  interviewTitle,
  onComplete,
}: AIThemeSuggestionsProps) => {
  const { themes, createTheme, fetchThemes } = useThemesStore();
  const { createOccurrence } = useThemeOccurrencesStore();
  const { success, error: showError } = useToastStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedTheme[]>([]);
  const [acceptedThemes, setAcceptedThemes] = useState<Set<string>>(new Set());

  const defaultColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  ];

  const handleSuggestThemes = async () => {
    if (!transcript.trim()) {
      showError('No transcript to analyze');
      return;
    }

    setIsGenerating(true);
    try {
      const prompt = `You are a qualitative researcher. Analyze this interview transcript and identify 5-8 recurring themes. For each theme provide:
- theme name (2-4 words)
- short description (1 sentence)
- 2-3 direct quotes from the transcript that represent this theme

Return ONLY a JSON array of theme objects in this exact format:
[
  {
    "name": "Theme Name",
    "description": "Brief description",
    "quotes": ["quote 1", "quote 2", "quote 3"]
  }
]

Transcript:
${transcript.substring(0, 50000)}`;

      const response = await callClaude({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048,
      });

      const usage = getUsageFromResponse(response);
      incrementUsage(usage.inputTokens + usage.outputTokens);

      if (response.content && response.content.length > 0 && response.content[0].type === 'text') {
        const text = response.content[0].text.trim();
        
        // Extract JSON from response
        let jsonText = text;
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }

        try {
          const parsed = JSON.parse(jsonText);
          if (Array.isArray(parsed)) {
            setSuggestions(parsed);
          } else {
            throw new Error('Invalid response format');
          }
        } catch (parseError) {
          console.error('Failed to parse AI response:', parseError);
          showError('Failed to parse AI suggestions. Please try again.');
        }
      }
    } catch (err: any) {
      console.error('Error generating theme suggestions:', err);
      showError(err.message || 'Failed to generate theme suggestions');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAcceptTheme = async (suggestion: SuggestedTheme, index: number) => {
    try {
      // Create theme
      const color = defaultColors[index % defaultColors.length];
      const themeId = await createTheme({
        name: suggestion.name,
        description: suggestion.description,
        color,
        parentThemeId: null,
        interviewIds: [],
        occurrenceCount: 0,
      });

      setAcceptedThemes(new Set([...acceptedThemes, suggestion.name]));

      // Find and tag quotes in transcript
      let taggedCount = 0;
      for (const quote of suggestion.quotes) {
        const quoteText = quote.trim().replace(/^["']|["']$/g, '');
        const startIndex = transcript.indexOf(quoteText);
        if (startIndex !== -1) {
          const endIndex = startIndex + quoteText.length;
          const contextBefore = transcript.substring(Math.max(0, startIndex - 100), startIndex);
          const contextAfter = transcript.substring(endIndex, Math.min(transcript.length, endIndex + 100));
          
          try {
            await createOccurrence({
              themeId,
              interviewId,
              interviewTitle,
              passageText: quoteText,
              passageContext: `${contextBefore}[SELECTED]${contextAfter}`,
              startIndex,
              endIndex,
            });
            taggedCount++;
          } catch (err) {
            console.warn('Failed to tag quote:', err);
          }
        }
      }

      success(`Created theme "${suggestion.name}" and tagged ${taggedCount} passages`);
      await fetchThemes();
      onComplete?.();
    } catch (err: any) {
      showError(err.message || 'Failed to create theme');
    }
  };

  if (suggestions.length === 0 && !isGenerating) {
    return (
      <Card className="p-4">
        <Button
          variant="outline"
          onClick={handleSuggestThemes}
          disabled={!transcript.trim()}
          className="w-full"
        >
          ✨ Suggest Themes from Transcript
        </Button>
      </Card>
    );
  }

  if (isGenerating) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-text-secondary text-text-secondary">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Analyzing transcript and generating theme suggestions...
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary text-text-primary">
          Suggested Themes
        </h3>
        <span className="text-xs text-text-muted text-text-secondary">
          Powered by Claude
        </span>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {suggestions.map((suggestion, index) => {
          const isAccepted = acceptedThemes.has(suggestion.name);
          return (
            <div
              key={index}
              className="p-3 border border-border-subtle border-border-default rounded-lg"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-medium text-text-primary text-text-primary">
                    {suggestion.name}
                  </h4>
                  <p className="text-sm text-text-secondary text-text-secondary mt-1">
                    {suggestion.description}
                  </p>
                </div>
                <div
                  className="w-4 h-4 rounded-full ml-2 flex-shrink-0"
                  style={{ backgroundColor: defaultColors[index % defaultColors.length] }}
                />
              </div>
              
              {suggestion.quotes && suggestion.quotes.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium text-text-primary text-text-primary">
                    Example quotes:
                  </p>
                  {suggestion.quotes.slice(0, 2).map((quote, qIdx) => (
                    <p key={qIdx} className="text-xs text-text-secondary text-text-secondary italic pl-2">
                      "{quote}"
                    </p>
                  ))}
                </div>
              )}

              <Button
                size="sm"
                variant={isAccepted ? 'outline' : 'primary'}
                onClick={() => handleAcceptTheme(suggestion, index)}
                disabled={isAccepted}
                className="w-full mt-3"
              >
                {isAccepted ? '✓ Accepted' : 'Accept & Auto-Tag'}
              </Button>
            </div>
          );
        })}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setSuggestions([]);
          setAcceptedThemes(new Set());
        }}
        className="w-full mt-3"
      >
        Dismiss
      </Button>
    </Card>
  );
};
