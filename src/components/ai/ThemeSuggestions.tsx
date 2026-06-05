import { useState } from 'react';
import { suggestThemes } from '../../utils/anthropic';
import { Tag } from '../ui/Tag';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useToastStore } from '../../stores/toastStore';

interface ThemeSuggestionsProps {
  content: string;
  onAccept: (themes: string[]) => void;
  existingTags?: string[];
}

export const ThemeSuggestions = ({
  content,
  onAccept,
  existingTags = [],
}: ThemeSuggestionsProps) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const { success, error } = useToastStore();

  const handleSuggest = async () => {
    if (!content.trim()) {
      error('No content to analyze');
      return;
    }

    setIsLoading(true);
    try {
      const themes = await suggestThemes(content);
      setSuggestions(themes);
      setSelected(new Set(themes));
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to suggest themes';
      error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelection = (theme: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(theme)) {
      newSelected.delete(theme);
    } else {
      newSelected.add(theme);
    }
    setSelected(newSelected);
  };

  const handleAccept = () => {
    const themesToAdd = Array.from(selected).filter(
      (t) => !existingTags.includes(t)
    );
    if (themesToAdd.length > 0) {
      onAccept(themesToAdd);
      success(`Added ${themesToAdd.length} theme(s)`);
      setSuggestions([]);
      setSelected(new Set());
    }
  };

  if (suggestions.length === 0 && !isLoading) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleSuggest}
        disabled={!content.trim()}
      >
        Suggest Themes ✨
      </Button>
    );
  }

  return (
    <Card className="p-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-text-primary text-text-primary">
          Suggested Themes
        </h4>
        <span className="text-xs text-text-muted text-text-secondary">
          Powered by Claude
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary text-text-secondary">
          <svg
            className="animate-spin h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Analyzing content...
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            {suggestions.map((theme) => (
              <Tag
                key={theme}
                variant={selected.has(theme) ? 'primary' : 'default'}
                className="cursor-pointer"
                onClick={() => toggleSelection(theme)}
              >
                {theme}
              </Tag>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAccept} disabled={selected.size === 0}>
              Accept Selected ({selected.size})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSuggestions([]);
                setSelected(new Set());
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};
