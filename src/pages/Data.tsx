import { useState, useEffect, useMemo } from 'react';
import { useDataFilesStore, useActivityStore } from '../stores';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Tag } from '../components/ui/Tag';
import { Dropdown } from '../components/ui/Dropdown';
import { format } from 'date-fns';
import { DynamicChart } from '../components/data/DynamicChart';
import { liveQuery } from 'dexie';
import { db, Interview, Theme, ThemeOccurrence } from '../utils/db';
import { useToastStore } from '../stores/toastStore';
import { getProxyHeaders } from '../utils/claudeClient';

interface ChartSpec {
  chartType: 'bar' | 'pie' | 'line' | 'radar' | 'scatter';
  title: string;
  description: string;
  data: Array<{ name: string; value: number; [key: string]: any }>;
  xAxisLabel?: string;
  yAxisLabel?: string;
  colors?: string[];
}

interface ChartHistoryItem {
  id: string;
  prompt: string;
  spec: ChartSpec;
}

const SUGGESTED_PROMPTS = [
  { text: 'Most common themes' },
  { text: 'Theme breakdown by participant' },
  { text: 'Co-occurring themes' },
  { text: 'Theme frequency over interview dates' },
];

export const Data = () => {
  const { dataFiles, fetchDataFiles, createDataFile, updateDataFile, deleteDataFile, setSelectedFile, selectedFile, searchDataFiles } = useDataFilesStore();
  const { addActivity } = useActivityStore();
  const { success, error: showError } = useToastStore();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<typeof selectedFile>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredFiles, setFilteredFiles] = useState(dataFiles);
  const [name, setName] = useState('');
  const [type, setType] = useState<'csv' | 'excel' | 'image' | 'pdf' | 'other'>('other');
  const [folder, setFolder] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // AI Agent state
  const [agentPrompt, setAgentPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chartHistory, setChartHistory] = useState<ChartHistoryItem[]>([]);

  // Live data from IndexedDB
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [themeOccurrences, setThemeOccurrences] = useState<ThemeOccurrence[]>([]);

  useEffect(() => {
    fetchDataFiles();
  }, [fetchDataFiles]);

  useEffect(() => {
    if (searchQuery.trim()) {
      searchDataFiles(searchQuery).then(setFilteredFiles);
    } else {
      setFilteredFiles(dataFiles);
    }
  }, [searchQuery, dataFiles, searchDataFiles]);

  // Live queries for interview data
  useEffect(() => {
    const interviewsObservable = liveQuery(() => db.interviews.toArray());
    const interviewsSubscription = interviewsObservable.subscribe({
      next: (result) => setInterviews(result || []),
      error: (error) => {
        console.error('Error in interviews live query:', error);
        setInterviews([]);
      }
    });

    const themesObservable = liveQuery(() => db.themes.toArray());
    const themesSubscription = themesObservable.subscribe({
      next: (result) => setThemes(result || []),
      error: (error) => {
        console.error('Error in themes live query:', error);
        setThemes([]);
      }
    });

    const occurrencesObservable = liveQuery(() => db.themeOccurrences.toArray());
    const occurrencesSubscription = occurrencesObservable.subscribe({
      next: (result) => setThemeOccurrences(result || []),
      error: (error) => {
        console.error('Error in themeOccurrences live query:', error);
        setThemeOccurrences([]);
      }
    });

    return () => {
      interviewsSubscription.unsubscribe();
      themesSubscription.unsubscribe();
      occurrencesSubscription.unsubscribe();
    };
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const totalInterviews = interviews.length;
    const totalThemes = themes.length;
    const totalTaggedPassages = themeOccurrences.length;
    
    // Find most common theme
    const themeCounts = themeOccurrences.reduce((acc, occ) => {
      acc[occ.themeId] = (acc[occ.themeId] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    const mostCommonThemeId = Object.entries(themeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const mostCommonTheme = mostCommonThemeId ? themes.find(t => t.id === Number(mostCommonThemeId)) : null;
    const mostCommonCount = mostCommonThemeId ? themeCounts[Number(mostCommonThemeId)] : 0;

    // Count unique participants
    const uniqueParticipants = new Set(
      interviews.map(i => i.interviewee || 'Unknown').filter(Boolean)
    ).size;

    return {
      totalInterviews,
      totalThemes,
      totalTaggedPassages,
      mostCommonTheme: mostCommonTheme?.name || 'None',
      mostCommonCount,
      uniqueParticipants,
    };
  }, [interviews, themes, themeOccurrences]);

  const handleAnalyze = async () => {
    if (!agentPrompt.trim()) {
      showError('Please enter a prompt');
      return;
    }

    if (interviews.length === 0) {
      showError('No interview data available. Add interviews first.');
      return;
    }

    setIsAnalyzing(true);
    try {
      // Prepare interview data with themes
      const interviewData = interviews.map(interview => ({
        id: interview.id,
        title: interview.interviewee,
        participantName: interview.interviewee,
        transcript: interview.transcript || '',
        date: interview.date,
        createdAt: interview.createdAt,
        themes: themeOccurrences
          .filter(occ => occ.interviewId === interview.id)
          .map(occ => {
            const theme = themes.find(t => String(t.id) === String(occ.themeId));
            return {
              themeId: occ.themeId,
              themeName: theme?.name || 'Unknown',
              passageText: occ.passageText,
            };
          }),
      }));

      const response = await fetch('/api/analyze-interviews', {
        method: 'POST',
        headers: getProxyHeaders(),
        body: JSON.stringify({
          userPrompt: agentPrompt,
          interviewData,
          themeOccurrences: themeOccurrences.map(occ => ({
            ...occ,
            themeName: themes.find(t => String(t.id) === String(occ.themeId))?.name || 'Unknown',
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyze interviews');
      }

      const chartSpec: ChartSpec = await response.json();

      // Add to history
      const newChart: ChartHistoryItem = {
        id: Date.now().toString(),
        prompt: agentPrompt,
        spec: chartSpec,
      };

      setChartHistory(prev => [newChart, ...prev]);
      setAgentPrompt('');
      success('Chart generated successfully!');
    } catch (err: any) {
      console.error('Failed to analyze:', err);
      showError(err.message || 'Failed to generate chart. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSuggestedPrompt = (text: string) => {
    setAgentPrompt(text);
  };

  const handleDeleteChart = (id: string) => {
    setChartHistory(prev => prev.filter(chart => chart.id !== id));
  };

  const handleClearAll = () => {
    if (confirm('Clear all charts?')) {
      setChartHistory([]);
    }
  };

  useEffect(() => {
    if (editingFile) {
      setName(editingFile.name);
      setType(editingFile.type);
      setFolder(editingFile.folder || '');
      setTags(editingFile.tags);
    } else {
      setName('');
      setType('other');
      setFolder('');
      setTags([]);
    }
  }, [editingFile]);

  const handleCreate = () => {
    setEditingFile(null);
    setIsFormOpen(true);
  };

  const handleEdit = (file: typeof selectedFile) => {
    setEditingFile(file);
    setSelectedFile(file);
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    if (editingFile) {
      await updateDataFile(editingFile.id, {
        name,
        type,
        folder: folder || undefined,
        tags,
      });
      await addActivity({ type: 'data', itemId: editingFile.id, action: 'updated' });
    } else {
      const id = await createDataFile({
        name,
        type,
        folder: folder || undefined,
        metadata: {},
        tags,
      });
      await addActivity({ type: 'data', itemId: id, action: 'created' });
    }
    setIsFormOpen(false);
    setEditingFile(null);
    setSelectedFile(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this file?')) {
      await deleteDataFile(id);
      await addActivity({ type: 'data', itemId: id, action: 'updated' });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'other';
      let fileCategory: 'csv' | 'excel' | 'image' | 'pdf' | 'other' = 'other';
      if (extension === 'csv') fileCategory = 'csv';
      else if (['xls', 'xlsx'].includes(extension)) fileCategory = 'excel';
      else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) fileCategory = 'image';
      else if (extension === 'pdf') fileCategory = 'pdf';

      const id = await createDataFile({
        name: file.name,
        type: fileCategory,
        fileData: file,
        metadata: {
          size: file.size,
          mimeType: file.type,
          uploadedAt: new Date().toISOString(),
        },
        tags: [],
      });
      await addActivity({ type: 'data', itemId: id, action: 'created' });
      success(`Uploaded ${file.name}`);
    } catch (err: any) {
      console.error('File upload failed:', err);
      showError(err.message || 'Failed to upload file');
    } finally {
      e.target.value = '';
    }
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Data</h1>
          <p className="text-text-secondary" style={{ fontSize: '14px', color: '#B0A898' }}>
            AI-powered analysis and data visualization
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileUpload}
            multiple
          />
          <Button type="button" onClick={() => document.getElementById('file-upload')?.click()}>
            Upload File
          </Button>
          <Button onClick={handleCreate}>New Entry</Button>
        </div>
      </div>

      {/* Stats */}
      <Card 
        className="p-6"
        style={{
          background: '#FFFFFF',
          border: '1px solid #F0EBE0',
          borderRadius: '16px'
        }}
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <div 
              className="text-xs uppercase tracking-wider"
              style={{ color: '#B0A898' }}
            >
              INTERVIEWS
            </div>
            <div 
              className="text-3xl font-bold"
              style={{ 
                fontFamily: 'Playfair Display, serif',
                color: '#111111' 
              }}
            >
              {stats.totalInterviews}
            </div>
          </div>
          <div>
            <div 
              className="text-xs uppercase tracking-wider"
              style={{ color: '#B0A898' }}
            >
              THEMES
            </div>
            <div 
              className="text-3xl font-bold"
              style={{ 
                fontFamily: 'Playfair Display, serif',
                color: '#111111' 
              }}
            >
              {stats.totalThemes}
            </div>
          </div>
          <div>
            <div 
              className="text-xs uppercase tracking-wider"
              style={{ color: '#B0A898' }}
            >
              TAGGED PASSAGES
            </div>
            <div 
              className="text-3xl font-bold"
              style={{ 
                fontFamily: 'Playfair Display, serif',
                color: '#111111' 
              }}
            >
              {stats.totalTaggedPassages}
            </div>
          </div>
          <div>
            <div 
              className="text-xs uppercase tracking-wider"
              style={{ color: '#B0A898' }}
            >
              MOST COMMON THEME
            </div>
            <div className="text-lg font-serif font-semibold text-text-primary">
              {stats.mostCommonTheme}
              {stats.mostCommonCount > 0 && (
                <span className="text-sm text-text-muted ml-1">
                  ({stats.mostCommonCount})
                </span>
              )}
            </div>
          </div>
          <div>
            <div 
              className="text-xs uppercase tracking-wider"
              style={{ color: '#B0A898' }}
            >
              PARTICIPANTS
            </div>
            <div 
              className="text-3xl font-bold"
              style={{ 
                fontFamily: 'Playfair Display, serif',
                color: '#111111' 
              }}
            >
              {stats.uniqueParticipants}
            </div>
          </div>
        </div>
      </Card>

      {/* AI Agent Section */}
      <Card 
        className="p-6"
        style={{
          background: '#FFFFFF',
          border: '1px solid #F0EBE0',
          borderRadius: '16px'
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 
            className="text-xl font-semibold"
            style={{ 
              fontFamily: 'Playfair Display, serif',
              color: '#111111' 
            }}
          >
            AI Analysis Agent
          </h2>
          {chartHistory.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearAll}>
              Clear All
            </Button>
          )}
        </div>

        {/* Chat Input */}
        <div className="mb-4">
          <Input
            value={agentPrompt}
            onChange={(e) => setAgentPrompt(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isAnalyzing && handleAnalyze()}
            placeholder="Ask the agent to generate a chart... e.g. 'Show me the most common themes across all interviews'"
            disabled={isAnalyzing}
            className="mb-3"
            style={{
              background: '#FAF8F3',
              borderColor: '#E5DED0',
              color: '#111111'
            }}
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestedPrompt(prompt.text)}
                  className="px-4 py-1.5 text-sm rounded-full transition-colors"
                  style={{
                    background: '#F5EDD8',
                    color: '#6B6358'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#E8C96A';
                    e.currentTarget.style.color = '#111111';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#F5EDD8';
                    e.currentTarget.style.color = '#6B6358';
                  }}
                >
                  {prompt.text}
                </button>
              ))}
            </div>
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !agentPrompt.trim()}
              className="px-4 py-2 rounded-xl font-semibold transition-colors"
              style={{
                background: '#E8C96A',
                color: '#111111',
                border: 'none'
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = '#D4B44A';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#E8C96A';
              }}
            >
              {isAnalyzing ? 'Analyzing...' : 'Generate Chart'}
            </button>
          </div>
        </div>

        {/* Chart History */}
        {chartHistory.length > 0 && (
          <div className="space-y-6 mt-6">
            {chartHistory.map((chart) => (
              <DynamicChart
                key={chart.id}
                spec={chart.spec}
                prompt={chart.prompt}
                onDelete={() => handleDeleteChart(chart.id)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Data Files Section */}
      <div>
        <h2 className="text-xl font-serif font-semibold text-text-primary mb-4">
          Data Files
        </h2>
        <Card 
          className="p-4 mb-4"
          style={{
            background: '#FAF8F3',
            border: '1px solid #E5DED0',
            borderRadius: '12px'
          }}
        >
          <Input
            placeholder="Search data files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: '#FAF8F3',
              borderColor: '#E5DED0',
              color: '#111111'
            }}
          />
        </Card>

        {filteredFiles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted">No data files yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFiles.map((file) => (
              <Card
                key={file.id}
                className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleEdit(file)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-text-primary">
                      {file.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-1 bg-accent-beige text-text-secondary rounded">
                        {file.type}
                      </span>
                      {file.folder && (
                        <span className="text-sm text-text-muted">
                          {file.folder}
                        </span>
                      )}
                    </div>
                    {file.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {file.tags.map((tag) => (
                          <Tag key={tag}>{tag}</Tag>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-text-muted mt-2">
                      {format(new Date(file.updatedAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(file.id);
                    }}
                    className="ml-4 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
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
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingFile(null);
          setSelectedFile(null);
        }}
        title={editingFile ? 'Edit Data File' : 'New Data File'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Dropdown
            label="Type"
            options={[
              { label: 'CSV', value: 'csv' },
              { label: 'Excel', value: 'excel' },
              { label: 'Image', value: 'image' },
              { label: 'PDF', value: 'pdf' },
              { label: 'Other', value: 'other' },
            ]}
            value={type}
            onChange={(value) => setType(value as typeof type)}
          />

          <Input
            label="Folder"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="Optional folder/category"
          />

          <div>
            <label className="block text-sm font-medium text-text-primary text-text-primary mb-2">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add tag"
                className="flex-1"
              />
              <Button type="button" onClick={addTag}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Tag key={tag} onRemove={() => removeTag(tag)}>
                  {tag}
                </Tag>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => {
              setIsFormOpen(false);
              setEditingFile(null);
              setSelectedFile(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
