import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemesStore, useThemeOccurrencesStore, useActivityStore } from '../stores';
import { useInterviewsStore } from '../stores/interviewsStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Dropdown } from '../components/ui/Dropdown';
import { Tag } from '../components/ui/Tag';
import { format } from 'date-fns';
import { liveQuery } from 'dexie';
import { db } from '../utils/db';
import { exportThemesToPDF, exportThemesToDOCX } from '../utils/themeExport';
import { useToastStore } from '../stores/toastStore';
import { callClaude, getUsageFromResponse } from '../utils/claudeClient';
import { incrementUsage } from '../utils/anthropic';
import type { Theme, ThemeOccurrence } from '../types';

interface CrossReferenceResult {
  cooccurrences: Array<{ theme1: string; theme2: string; explanation: string }>;
  conflicts: Array<{ theme1: string; theme2: string; explanation: string }>;
  higherOrder: Array<{ name: string; description: string; unifies: string[] }>;
}

export const Themes = () => {
  const navigate = useNavigate();
  const { themes, fetchThemes, createTheme, updateTheme, deleteTheme, setSelectedTheme } = useThemesStore();
  const { fetchOccurrences, getOccurrencesByTheme, deleteOccurrence, updateOccurrence } = useThemeOccurrencesStore();
  const { interviews, fetchInterviews } = useInterviewsStore();
  const { addActivity } = useActivityStore();
  const { success, error: showError } = useToastStore();
  const [isExporting, setIsExporting] = useState(false);
  
  const [viewMode, setViewMode] = useState<'overview' | 'detail'>('overview');
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [themeOccurrences, setThemeOccurrences] = useState<ThemeOccurrence[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterInterviewId, setFilterInterviewId] = useState<string>('');
  const [sortBy, setSortBy] = useState<'occurrences' | 'alphabetical' | 'recent'>('occurrences');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [memo, setMemo] = useState('');
  const [parentThemeId, setParentThemeId] = useState<string | null>(null);

  // Use liveQuery for real-time updates
  const [liveThemes, setLiveThemes] = useState<Theme[]>([]);
  const [liveOccurrences, setLiveOccurrences] = useState<ThemeOccurrence[]>([]);
  const [isClustering, setIsClustering] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareInterviewIds, setCompareInterviewIds] = useState<string[]>([]);
  const [clusteringSuggestions, setClusteringSuggestions] = useState<any[] | null>(null);
  const [isCrossReferencing, setIsCrossReferencing] = useState(false);
  const [crossReferenceResult, setCrossReferenceResult] = useState<CrossReferenceResult | null>(null);
  const [showCrossReferenceModal, setShowCrossReferenceModal] = useState(false);

  useEffect(() => {
    // Subscribe to themes changes
    // Note: new schema uses createdAt, not updatedAt
    const themesObservable = liveQuery(() => 
      db.themes.orderBy('createdAt').reverse().toArray()
    );
    
    const themesSubscription = themesObservable.subscribe({
      next: (result) => {
        // Convert numeric IDs to strings for compatibility with Theme interface
        const themesWithStringIds = (result || []).map(theme => ({
          ...theme,
          id: String(theme.id),
          parentThemeId: theme.parentThemeId ? String(theme.parentThemeId) : null,
        }));
        setLiveThemes(themesWithStringIds as Theme[]);
      },
      error: (error) => {
        console.error('Error in themes live query:', error);
        setLiveThemes([]);
        fetchThemes();
      }
    });

    return () => {
      themesSubscription.unsubscribe();
    };
  }, []);

  // Live query for all theme occurrences (for stats calculation)
  const [allOccurrences, setAllOccurrences] = useState<ThemeOccurrence[]>([]);
  
  useEffect(() => {
    const occurrencesObservable = liveQuery(() => 
      db.themeOccurrences.toArray()
    );
    
    const occurrencesSubscription = occurrencesObservable.subscribe({
      next: (result) => {
        // Convert numeric IDs to strings for compatibility
        const occurrencesWithStringIds = (result || []).map(occ => ({
          ...occ,
          id: String(occ.id),
          themeId: String(occ.themeId),
          interviewId: String(occ.interviewId),
        }));
        setAllOccurrences(occurrencesWithStringIds as ThemeOccurrence[]);
      },
      error: (error) => {
        console.error('Error in all occurrences live query:', error);
        setAllOccurrences([]);
      }
    });

    return () => {
      occurrencesSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!selectedThemeId) {
      setLiveOccurrences([]);
      return;
    }

    // Subscribe to occurrences changes for selected theme
    const themeIdNum = Number(selectedThemeId);
    const occurrencesObservable = liveQuery(() => 
      db.themeOccurrences.where('themeId').equals(themeIdNum).toArray()
    );
    
    const occurrencesSubscription = occurrencesObservable.subscribe({
      next: (result) => {
        // Convert numeric IDs to strings for compatibility
        const occurrencesWithStringIds = (result || []).map(occ => ({
          ...occ,
          id: String(occ.id),
          themeId: String(occ.themeId),
          interviewId: String(occ.interviewId),
        }));
        setLiveOccurrences(occurrencesWithStringIds as ThemeOccurrence[]);
      },
      error: (error) => {
        console.error('Error in occurrences live query:', error);
        setLiveOccurrences([]);
      }
    });

    return () => {
      occurrencesSubscription.unsubscribe();
    };
  }, [selectedThemeId]);

  useEffect(() => {
    fetchThemes();
    fetchInterviews();
    fetchOccurrences();
  }, [fetchThemes, fetchInterviews, fetchOccurrences]);

  useEffect(() => {
    if (selectedThemeId) {
      getOccurrencesByTheme(selectedThemeId).then(setThemeOccurrences);
    }
  }, [selectedThemeId, getOccurrencesByTheme, liveOccurrences]);

  // Helper function to get theme stats from live occurrences
  const getThemeStats = (themeId: string | number) => {
    const themeIdStr = String(themeId);
    const occurrences = allOccurrences.filter(
      o => String(o.themeId) === themeIdStr
    ) || [];
    const uniqueInterviews = new Set(
      occurrences.map(o => String(o.interviewId))
    ).size;
    return {
      count: occurrences.length,
      interviewCount: uniqueInterviews,
    };
  };

  // Merge live query + store so themes appear even if one source fails or lags
  const themesToUse = useMemo(() => {
    const merged = new Map<string, Theme>();
    for (const theme of themes) {
      merged.set(String(theme.id), theme);
    }
    for (const theme of liveThemes) {
      merged.set(String(theme.id), theme);
    }
    return Array.from(merged.values());
  }, [themes, liveThemes]);
  const filteredThemes = (Array.isArray(themesToUse) ? themesToUse : []).map(theme => {
    // Calculate live stats from occurrences
    const stats = getThemeStats(theme.id);
    return {
      ...theme,
      occurrenceCount: stats.count,
      interviewIds: Array.from(new Set(
        allOccurrences
          .filter(o => String(o.themeId) === String(theme.id))
          .map(o => String(o.interviewId))
      )),
    };
  }).filter(theme => {
    if (searchQuery && !theme.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !theme.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterInterviewId && !theme.interviewIds?.includes(filterInterviewId)) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'occurrences') {
      return (b.occurrenceCount || 0) - (a.occurrenceCount || 0);
    } else if (sortBy === 'alphabetical') {
      return a.name.localeCompare(b.name);
    } else {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  const handleCreate = () => {
    setEditingTheme(null);
    setName('');
    setDescription('');
    setColor('#3b82f6');
    setMemo('');
    setParentThemeId(null);
    setIsFormOpen(true);
  };

  const handleViewDetail = async (theme: Theme) => {
    if (!theme.id) return;
    setSelectedThemeId(theme.id);
    setSelectedTheme(theme);
    setViewMode('detail');
    const occs = await getOccurrencesByTheme(String(theme.id));
    setThemeOccurrences(occs);
  };

  const handleEdit = (theme: Theme) => {
    setEditingTheme(theme);
    setName(theme.name);
    setDescription(theme.description);
    setColor(theme.color);
    setMemo(theme.memo || '');
    setParentThemeId(theme.parentThemeId || null);
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      showError('Theme name is required');
      return;
    }

    try {
      if (editingTheme) {
        await updateTheme(editingTheme.id, { 
          name: name.trim(), 
          description: description.trim(), 
          color, 
          memo: memo || undefined,
          parentThemeId: parentThemeId || null,
        });
        await addActivity({ type: 'theme', itemId: editingTheme.id, action: 'updated' });
        success('Theme updated');
      } else {
        const id = await createTheme({ 
          name: name.trim(), 
          description: description.trim(), 
          color, 
          memo: memo || undefined,
          parentThemeId: parentThemeId || null,
          interviewIds: [],
          occurrenceCount: 0,
        });
        await addActivity({ type: 'theme', itemId: id, action: 'created' });
        success('Theme created');
      }
      setIsFormOpen(false);
      setEditingTheme(null);
      setName('');
      setDescription('');
      setMemo('');
    } catch (err: any) {
      showError(err.message || 'Failed to save theme');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this theme? All tagged passages will be untagged.')) {
      // Delete all occurrences first
      const occs = await getOccurrencesByTheme(id);
      for (const occ of occs) {
        await deleteOccurrence(occ.id);
      }
      await deleteTheme(id);
      await addActivity({ type: 'theme', itemId: id, action: 'updated' });
      if (selectedThemeId === id) {
        setViewMode('overview');
        setSelectedThemeId(null);
      }
    }
  };

  const handleViewInInterview = (occurrence: ThemeOccurrence) => {
    navigate(`/interviews?view=${occurrence.interviewId}&highlight=${occurrence.startIndex}`);
  };

  const handleRemoveTag = async (occurrenceId: string) => {
    if (confirm('Remove this tag?')) {
      await deleteOccurrence(occurrenceId);
      if (selectedThemeId) {
        const occs = await getOccurrencesByTheme(selectedThemeId);
        setThemeOccurrences(occs);
      }
    }
  };

  const handleCrossReferenceThemes = async () => {
    const themesData = liveThemes.length > 0 ? liveThemes : themes;
    if (!Array.isArray(themesData) || themesData.length === 0) {
      showError('Add at least one theme before cross-referencing');
      return;
    }
    if (interviews.length === 0) {
      showError('Add at least one interview transcript before cross-referencing');
      return;
    }

    setIsCrossReferencing(true);
    setCrossReferenceResult(null);

    try {
      const themesSummary = themesData
        .map((t) => `Theme: ${t.name}\nDescription: ${t.description}\nMemo: ${t.memo || 'N/A'}`)
        .join('\n\n');

      const transcriptsSummary = interviews
        .map((i) => `Interview (${i.interviewee}):\n${i.transcript.substring(0, 4000)}`)
        .join('\n\n---\n\n');

      const prompt = `Given these research themes and interview transcripts, identify which themes appear together most often, which themes conflict, and suggest 2-3 higher-order themes that could unify them.

Themes:
${themesSummary}

Interview transcripts:
${transcriptsSummary}

Return ONLY JSON in this format:
{
  "cooccurrences": [{"theme1": "string", "theme2": "string", "explanation": "string"}],
  "conflicts": [{"theme1": "string", "theme2": "string", "explanation": "string"}],
  "higherOrder": [{"name": "string", "description": "string", "unifies": ["themeName1", "themeName2"]}]
}`;

      const response = await callClaude({
        messages: [{ role: 'user', content: prompt }],
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
      });

      const usage = getUsageFromResponse(response);
      incrementUsage(usage.inputTokens + usage.outputTokens);

      if (!response.content?.[0] || response.content[0].type !== 'text') {
        throw new Error('Unexpected response from AI');
      }

      let text = response.content[0].text.trim();
      text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse cross-reference results');
      }

      const parsed = JSON.parse(jsonMatch[0]) as CrossReferenceResult;
      setCrossReferenceResult(parsed);
      setShowCrossReferenceModal(true);
    } catch (err: any) {
      showError(err.message || 'Failed to cross-reference themes');
    } finally {
      setIsCrossReferencing(false);
    }
  };

  const handleAddHigherOrderTheme = async (suggestion: CrossReferenceResult['higherOrder'][0]) => {
    try {
      const id = await createTheme({
        name: suggestion.name,
        description: suggestion.description,
        color: '#7C68CC',
        memo: `Umbrella theme unifying: ${suggestion.unifies.join(', ')}`,
        parentThemeId: null,
        interviewIds: [],
        occurrenceCount: 0,
      });
      await addActivity({ type: 'theme', itemId: id, action: 'created' });
      success(`Theme "${suggestion.name}" created`);
    } catch (err: any) {
      showError(err.message || 'Failed to create theme');
    }
  };

  const handleFindSimilarThemes = async (theme: Theme) => {
    setIsClustering(true);
    setClusteringSuggestions(null);
    
    try {
      const allThemes = await db.themes.toArray();
      const otherThemes = allThemes.filter(t => t.id !== theme.id);
      
      if (otherThemes.length === 0) {
        showError('No other themes to compare with');
        setIsClustering(false);
        return;
      }

      const themesList = otherThemes.map(t => `- ${t.name}: ${t.description}`).join('\n');
      
      const prompt = `You are a qualitative researcher. Analyze these themes and identify which ones are closely related to "${theme.name}" (${theme.description}).

Other themes:
${themesList}

Return a JSON array of theme grouping suggestions. Each suggestion should include:
- "themes": array of theme names that are related (including the original theme name)
- "reasoning": brief explanation of why these themes are related

Return ONLY a JSON array in this format:
[
  {
    "themes": ["Theme 1", "Theme 2"],
    "reasoning": "Both themes relate to..."
  }
]`;

      const response = await callClaude({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
      });

      const usage = getUsageFromResponse(response);
      incrementUsage(usage.inputTokens + usage.outputTokens);

      if (response.content && response.content.length > 0 && response.content[0].type === 'text') {
        const text = response.content[0].text.trim();
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
              setClusteringSuggestions(parsed);
            }
          } catch (e) {
            console.error('Failed to parse clustering suggestions:', e);
            showError('Failed to parse clustering suggestions');
          }
        }
      }
    } catch (err: any) {
      console.error('Error finding similar themes:', err);
      showError(err.message || 'Failed to find similar themes');
    } finally {
      setIsClustering(false);
    }
  };

  // Group occurrences by interview title (for display)
  const occurrencesByInterview = liveOccurrences.reduce((acc, occ) => {
    const key = occ.interviewTitle || 'Unknown Interview';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(occ);
    return acc;
  }, {} as Record<string, ThemeOccurrence[]>);

  const themesList = liveThemes.length > 0 ? liveThemes : themes;
  const selectedTheme = Array.isArray(themesList) ? themesList.find(t => t.id === selectedThemeId) : null;

  if (viewMode === 'detail' && selectedTheme) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => {
              setViewMode('overview');
              setSelectedThemeId(null);
            }}>
              ← Back to Themes
            </Button>
            <div>
              <h1 className="page-title">
                {selectedTheme.name}
              </h1>
              <p className="text-text-secondary" style={{ fontSize: '14px', color: '#B0A898' }}>
                {selectedTheme.description}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCrossReferenceThemes}
              disabled={isCrossReferencing}
            >
              {isCrossReferencing ? 'Analyzing...' : '✨ Cross-Reference Themes'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleFindSimilarThemes(selectedTheme)}
              disabled={isClustering}
            >
              {isClustering ? 'Analyzing...' : '🔍 Find Similar Themes'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setCompareMode(!compareMode)}
            >
              {compareMode ? 'Exit Compare' : 'Compare Interviews'}
            </Button>
            <Button 
              variant="outline" 
              onClick={async () => {
                setIsExporting(true);
                try {
                  await exportThemesToPDF(selectedTheme.id);
                  success('Theme exported to PDF');
                } catch (err: any) {
                  showError(err.message || 'Failed to export');
                } finally {
                  setIsExporting(false);
                }
              }}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </Button>
            <Button 
              variant="outline" 
              onClick={async () => {
                setIsExporting(true);
                try {
                  await exportThemesToDOCX(selectedTheme.id);
                  success('Theme exported to DOCX');
                } catch (err: any) {
                  showError(err.message || 'Failed to export');
                } finally {
                  setIsExporting(false);
                }
              }}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting...' : 'Export DOCX'}
            </Button>
            <Button variant="outline" onClick={() => handleEdit(selectedTheme)}>
              Edit Theme
            </Button>
            <Button variant="danger" onClick={() => handleDelete(selectedTheme.id)}>
              Delete
            </Button>
          </div>
        </div>

        {compareMode ? (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-text-primary text-text-primary">
                  Select up to 3 interviews to compare:
                </label>
                <div className="flex gap-2 flex-1">
                  {Object.keys(occurrencesByInterview).slice(0, 3).map(interviewId => {
                    const interview = interviews.find(i => i.id === interviewId);
                    const isSelected = compareInterviewIds.includes(interviewId);
                    return (
                      <Button
                        key={interviewId}
                        size="sm"
                        variant={isSelected ? 'primary' : 'outline'}
                        onClick={() => {
                          if (isSelected) {
                            setCompareInterviewIds(compareInterviewIds.filter(id => id !== interviewId));
                          } else if (compareInterviewIds.length < 3) {
                            setCompareInterviewIds([...compareInterviewIds, interviewId]);
                          }
                        }}
                      >
                        {interview?.interviewee || 'Unknown'}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </Card>

            {compareInterviewIds.length > 0 && (
              <div 
                className="grid gap-4"
                style={{ gridTemplateColumns: `repeat(${compareInterviewIds.length}, 1fr)` }}
              >
                {compareInterviewIds.map(interviewId => {
                  const interview = interviews.find(i => i.id === interviewId);
                  const occs = occurrencesByInterview[interviewId] || [];
                  return (
                    <Card key={interviewId} className="p-4">
                      <h3 className="font-semibold text-text-primary text-text-primary mb-3">
                        {interview?.interviewee || 'Unknown'}
                      </h3>
                      <div className="space-y-3 max-h-[600px] overflow-y-auto">
                        {occs.map(occ => (
                          <div
                            key={occ.id}
                            className="p-3 bg-bg-secondary bg-bg-secondary rounded border-l-4"
                            style={{ borderLeftColor: selectedTheme.color }}
                          >
                            <p className="text-sm text-text-primary text-text-primary">
                              "{occ.passageText}"
                            </p>
                            {occ.note && (
                              <p className="text-xs text-text-secondary text-text-secondary mt-1">
                                Note: {occ.note}
                              </p>
                            )}
                          </div>
                        ))}
                        {occs.length === 0 && (
                          <p className="text-sm text-text-muted text-text-secondary">
                            No passages tagged in this interview
                          </p>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel - Theme Info */}
            <Card className="p-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-text-primary text-text-primary">
                  Color
                </label>
                <div className="flex items-center gap-3 mt-2">
                  <div
                    className="w-12 h-12 rounded"
                    style={{ backgroundColor: selectedTheme.color }}
                  />
                  <Input
                    type="color"
                    value={selectedTheme.color}
                    onChange={(e) => updateTheme(selectedTheme.id, { color: e.target.value })}
                    className="w-20"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-text-primary text-text-primary">
                  Stats
                </label>
                <div className="mt-2 space-y-2 text-sm">
                  <p><strong>{selectedTheme.occurrenceCount || 0}</strong> tagged passages</p>
                  <p><strong>{selectedTheme.interviewIds?.length || 0}</strong> interviews</p>
                </div>
              </div>

              {selectedTheme.parentThemeId && (
                <div>
                  <label className="text-sm font-medium text-text-primary text-text-primary">
                    Parent Theme
                  </label>
                  <p className="mt-1 text-sm text-text-secondary text-text-secondary">
                    {themesList.find(t => t.id === selectedTheme.parentThemeId)?.name || 'Unknown'}
                  </p>
                </div>
              )}

              {selectedTheme.memo && (
                <div>
                  <label className="text-sm font-medium text-text-primary text-text-primary">
                    Memo
                  </label>
                  <div 
                    className="mt-2 text-sm text-text-secondary text-text-secondary"
                    dangerouslySetInnerHTML={{ __html: selectedTheme.memo }}
                  />
                </div>
              )}

              {clusteringSuggestions && clusteringSuggestions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border-subtle border-border-default">
                  <label className="text-sm font-medium text-text-primary text-text-primary mb-2">
                    Similar Themes
                  </label>
                  <div className="space-y-2">
                    {clusteringSuggestions.map((suggestion, idx) => (
                      <div key={idx} className="p-2 bg-primary-50 bg-accent-gold-soft rounded text-xs">
                        <p className="font-medium text-primary-900 dark:text-primary-100">
                          {suggestion.themes.join(', ')}
                        </p>
                        <p className="text-primary-700 text-accent-gold-dim mt-1">
                          {suggestion.reasoning}
                        </p>
                      </div>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setClusteringSuggestions(null)}
                    className="mt-2 w-full"
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Right Panel - Passages */}
          <div className="lg:col-span-2 space-y-6">
            {Object.entries(occurrencesByInterview).map(([title, passages]) => {
              const firstPassage = passages[0];
              const interview = interviews.find(i => String(i.id) === firstPassage?.interviewId);
              return (
                <div key={title} className="mb-6">
                  {/* Interview header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[14px]">📄</span>
                    <p className="text-[13px] font-semibold text-[#1A1714]">
                      {title}
                    </p>
                    <span className="text-[11px] text-[#B5AFA8]">
                      ({passages.length} passage{passages.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                  
                  {/* Passage cards */}
                  {passages.map(passage => (
                    <div 
                      key={passage.id}
                      className="bg-white border border-[#EEEBE4] rounded-xl p-4 mb-3"
                    >
                      <p 
                        className="text-[13px] text-[#1A1714] italic leading-relaxed border-l-2 pl-3 mb-2"
                        style={{ borderColor: selectedTheme.color }}
                      >
                        "{passage.passageText}"
                      </p>
                      {passage.note && (
                        <p className="text-[12px] text-[#7C7469] mt-2">
                          Note: {passage.note}
                        </p>
                      )}
                      <button
                        onClick={() => navigate(`/interviews?view=${passage.interviewId}`)}
                        className="text-[11px] text-[#7C68CC] hover:underline mt-2 flex items-center gap-1"
                      >
                        <span>↗</span> View in interview
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}

            {liveOccurrences.length === 0 && (
              <Card className="p-12 text-center">
                <p className="text-text-muted text-text-secondary">
                  No passages tagged with this theme yet.
                </p>
                <p className="text-sm text-text-muted text-text-muted mt-2">
                  Go to an interview and select text to tag it with this theme.
                </p>
              </Card>
            )}
          </div>
        </div>
        )}
      </div>
    );
  }

  // Overview mode
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Themes</h1>
          <p className="text-text-secondary" style={{ fontSize: '14px', color: '#B0A898' }}>
            Track and analyze research themes across interviews
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              setIsExporting(true);
              try {
                await exportThemesToPDF();
                success('All themes exported to PDF');
              } catch (err: any) {
                showError(err.message || 'Failed to export');
              } finally {
                setIsExporting(false);
              }
            }}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl transition-colors"
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5DED0',
              color: '#6B6358'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#FAF8F3';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#FFFFFF';
            }}
          >
            {isExporting ? 'Exporting...' : 'Export All PDF'}
          </button>
          <Button
            variant="outline"
            onClick={handleCrossReferenceThemes}
            disabled={isCrossReferencing}
          >
            {isCrossReferencing ? 'Analyzing...' : '✨ Cross-Reference Themes'}
          </Button>
          <Button onClick={handleCreate}>New Theme</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <Card 
          className="p-4 flex-1 min-w-[200px]"
          style={{
            background: '#FAF8F3',
            border: '1px solid #E5DED0',
            borderRadius: '12px'
          }}
        >
          <Input
            placeholder="Search themes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </Card>
        <div className="w-48">
          <Dropdown
            label="Filter by Interview"
            options={[
              { value: '', label: 'All Interviews' },
              ...interviews.map(i => ({ value: i.id, label: i.interviewee })),
            ]}
            value={filterInterviewId}
            onChange={setFilterInterviewId}
          />
        </div>
        <div className="w-48">
          <Dropdown
            label="Sort By"
            options={[
              { value: 'occurrences', label: 'Most Occurrences' },
              { value: 'alphabetical', label: 'Alphabetical' },
              { value: 'recent', label: 'Most Recent' },
            ]}
            value={sortBy}
            onChange={(value) => setSortBy(value as typeof sortBy)}
          />
        </div>
      </div>

      {filteredThemes.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-text-muted text-text-secondary">
            {themesToUse.length > 0 && (searchQuery || filterInterviewId)
              ? 'No themes match your current filters.'
              : 'No themes found'}
          </p>
          {themesToUse.length > 0 && filterInterviewId && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setFilterInterviewId('')}
            >
              Clear interview filter
            </Button>
          )}
          {themesToUse.length === 0 && (
            <p className="text-sm text-text-muted mt-2">Click &quot;New Theme&quot; to create your first theme.</p>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredThemes.map((theme) => (
            <Card
              key={theme.id}
              className="p-5 hover:shadow-md transition-all cursor-pointer"
              style={{
                background: '#FFFFFF',
                border: '1px solid #F0EBE0',
                borderRadius: '16px'
              }}
              onClick={() => handleViewDetail(theme)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-1 h-12 rounded"
                      style={{ backgroundColor: theme.color }}
                    />
                    <div className="flex-1">
                      <h3 
                        className="text-lg font-semibold"
                        style={{ 
                          fontFamily: 'Playfair Display, serif',
                          color: '#111111' 
                        }}
                      >
                        {theme.name}
                      </h3>
                      <p className="text-sm mt-1" style={{ color: '#6B6358' }}>
                        {theme.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-sm" style={{ color: '#B0A898' }}>
                    <p>Appears in <strong>{theme.interviewIds?.length || 0}</strong> interviews</p>
                    <p><strong>{theme.occurrenceCount || 0}</strong> tagged passages</p>
                  </div>
                  {theme.interviewIds && theme.interviewIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {theme.interviewIds.slice(0, 3).map(id => {
                        const interview = interviews.find(i => i.id === id);
                        return interview ? (
                          <Tag key={id} size="sm">{interview.interviewee}</Tag>
                        ) : null;
                      })}
                      {theme.interviewIds.length > 3 && (
                        <Tag size="sm">+{theme.interviewIds.length - 3} more</Tag>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(theme.id);
                  }}
                  className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={showCrossReferenceModal}
        onClose={() => setShowCrossReferenceModal(false)}
        title="Theme Cross-Reference"
        size="xl"
      >
        {crossReferenceResult && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            <section>
              <h3 className="text-sm font-semibold text-[#5A9E76] uppercase tracking-wide mb-3">
                Co-occurrences
              </h3>
              <div className="space-y-2">
                {crossReferenceResult.cooccurrences?.length ? (
                  crossReferenceResult.cooccurrences.map((item, idx) => (
                    <Card key={idx} className="p-4 bg-[#EFF7F3] border border-[#C8E6D4]">
                      <p className="font-semibold text-[#1A1714]">
                        {item.theme1} + {item.theme2}
                      </p>
                      <p className="text-sm text-[#7C7469] mt-1">{item.explanation}</p>
                    </Card>
                  ))
                ) : (
                  <p className="text-sm text-text-secondary">No co-occurrences identified.</p>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-[#B8920A] uppercase tracking-wide mb-3">
                Tensions
              </h3>
              <div className="space-y-2">
                {crossReferenceResult.conflicts?.length ? (
                  crossReferenceResult.conflicts.map((item, idx) => (
                    <Card key={idx} className="p-4 bg-[#FBF6E8] border border-[#F0E0A0]">
                      <p className="font-semibold text-[#1A1714]">
                        {item.theme1} vs {item.theme2}
                      </p>
                      <p className="text-sm text-[#7C7469] mt-1">{item.explanation}</p>
                    </Card>
                  ))
                ) : (
                  <p className="text-sm text-text-secondary">No tensions identified.</p>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-[#7C68CC] uppercase tracking-wide mb-3">
                Suggested Umbrella Themes
              </h3>
              <div className="space-y-2">
                {crossReferenceResult.higherOrder?.length ? (
                  crossReferenceResult.higherOrder.map((item, idx) => (
                    <Card key={idx} className="p-4 bg-[#F5F1FF] border border-[#D4C8F0]">
                      <p className="font-semibold text-[#1A1714]">{item.name}</p>
                      <p className="text-sm text-[#7C7469] mt-1">{item.description}</p>
                      {item.unifies?.length > 0 && (
                        <p className="text-xs text-[#7C68CC] mt-2">
                          Unifies: {item.unifies.join(', ')}
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => handleAddHigherOrderTheme(item)}
                      >
                        Add as Theme
                      </Button>
                    </Card>
                  ))
                ) : (
                  <p className="text-sm text-text-secondary">No umbrella themes suggested.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingTheme(null);
        }}
        title={editingTheme ? 'Edit Theme' : 'New Theme'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <div>
            <label className="block text-sm font-medium text-text-primary text-text-primary mb-2">
              Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-16 h-10 rounded border border-border-default border-border-default"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3b82f6"
                className="flex-1"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary text-text-primary mb-2">
              Parent Theme (optional)
            </label>
            <Dropdown
              options={[
                { value: '', label: 'None' },
                ...themesList
                  .filter(t => !editingTheme || t.id !== editingTheme.id)
                  .map(t => ({ value: t.id, label: t.name })),
              ]}
              value={parentThemeId || ''}
              onChange={(value) => setParentThemeId(value || null)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => {
              setIsFormOpen(false);
              setEditingTheme(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Save Theme</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
