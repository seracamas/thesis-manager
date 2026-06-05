import { useState, useEffect, useRef } from 'react';
import { useThemesStore } from '../../stores/themesStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';

interface ThemeTagPopoverProps {
  selectedText: string;
  context: string;
  startIndex: number;
  endIndex: number;
  interviewId: string;
  interviewTitle: string;
  onTag: (themeId: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

export const ThemeTagPopover = ({
  selectedText,
  context,
  startIndex,
  endIndex,
  interviewId,
  interviewTitle,
  onTag,
  onClose,
  position,
}: ThemeTagPopoverProps) => {
  const { themes, createTheme, fetchThemes } = useThemesStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeDescription, setNewThemeDescription] = useState('');
  const [newThemeColor, setNewThemeColor] = useState('#3b82f6');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchThemes();
  }, [fetchThemes]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const filteredThemes = themes.filter(theme =>
    theme.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    theme.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateTheme = async () => {
    if (!newThemeName.trim()) return;
    
    const themeId = await createTheme({
      name: newThemeName.trim(),
      description: newThemeDescription.trim() || `Theme related to: ${selectedText.substring(0, 50)}...`,
      color: newThemeColor,
      parentThemeId: null,
      interviewIds: [],
      occurrenceCount: 0,
    });
    
    setShowCreateForm(false);
    setNewThemeName('');
    setNewThemeDescription('');
    onTag(themeId);
  };

  const defaultColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  ];

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-white bg-white rounded-lg shadow-xl border border-border-subtle border-border-default p-4 min-w-[320px] max-w-md max-h-[500px] overflow-y-auto"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -100%)',
        marginTop: '-8px',
      }}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-text-primary text-text-primary">
            🏷 Tag Theme
          </h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-secondary dark:hover:text-neutral-300"
          >
            ✕
          </button>
        </div>

        {!showCreateForm ? (
          <>
            <Input
              placeholder="Search themes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-sm"
            />

            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {filteredThemes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => onTag(theme.id)}
                  className="w-full text-left p-2 rounded hover:bg-bg-input hover:bg-accent-gold-soft flex items-center gap-2"
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: theme.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary text-text-primary truncate">
                      {theme.name}
                    </div>
                    {theme.description && (
                      <div className="text-xs text-text-muted text-text-secondary truncate">
                        {theme.description}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateForm(true)}
              className="w-full"
            >
              + Create New Theme
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            <Input
              label="Theme Name"
              value={newThemeName}
              onChange={(e) => setNewThemeName(e.target.value)}
              placeholder="e.g., Learning Strategies"
              required
            />
            <Input
              label="Description"
              value={newThemeDescription}
              onChange={(e) => setNewThemeDescription(e.target.value)}
              placeholder="Brief description..."
            />
            <div>
              <label className="block text-xs font-medium text-text-primary text-text-primary mb-2">
                Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newThemeColor}
                  onChange={(e) => setNewThemeColor(e.target.value)}
                  className="w-12 h-8 rounded border border-border-default border-border-default"
                />
                <div className="flex gap-1 flex-1">
                  {defaultColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewThemeColor(color)}
                      className="w-6 h-6 rounded border-2 border-transparent hover:border-neutral-400"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewThemeName('');
                  setNewThemeDescription('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreateTheme}
                disabled={!newThemeName.trim()}
                className="flex-1"
              >
                Create & Tag
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
