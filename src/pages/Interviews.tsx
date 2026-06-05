import { useState, useEffect } from 'react';
import { useInterviewsStore, useActivityStore } from '../stores';
import { useThemeOccurrencesStore } from '../stores/themeOccurrencesStore';
import { useThemesStore } from '../stores/themesStore';
import { useToastStore } from '../stores/toastStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Tag } from '../components/ui/Tag';
import { ThemeSuggestions } from '../components/ai/ThemeSuggestions';
import { AIThemeSuggestions } from '../components/themes/AIThemeSuggestions';
import { SelectableText } from '../components/themes/SelectableText';
import { summarizeContent } from '../utils/anthropic';
import { format } from 'date-fns';
import { liveQuery } from 'dexie';
import { db, Interview as DBInterview } from '../utils/db';

// Lazy load PDF.js to avoid errors if package not installed
let pdfjsLib: any = null;
async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  try {
    const module = await import('pdfjs-dist');
    pdfjsLib = module;
    // Configure PDF.js worker - use local worker from installed package
    if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
      // Use local worker from installed package to match version automatically
      pdfjsLib.GlobalWorkerOptions.workerSrc = 
        new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
    }
    return pdfjsLib;
  } catch (error) {
    console.warn('pdfjs-dist not available. Install with: npm install pdfjs-dist');
    return null;
  }
}

export const Interviews = () => {
  const { addActivity } = useActivityStore();
  const { fetchOccurrences, getOccurrencesByInterview } = useThemeOccurrencesStore();
  const { themes, fetchThemes } = useThemesStore();
  const { success, error: showError } = useToastStore();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [viewingInterview, setViewingInterview] = useState<DBInterview | null>(null);
  const [viewingOccurrences, setViewingOccurrences] = useState<Array<{ themeId: number; startIndex: number; endIndex: number; color: string }>>([]);
  const [editingInterview, setEditingInterview] = useState<DBInterview | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [interviewee, setInterviewee] = useState('');
  const [privacyCode, setPrivacyCode] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('');
  const [transcript, setTranscript] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Use liveQuery for real-time updates
  const [interviews, setInterviews] = useState<DBInterview[]>([]);
  const [filteredInterviews, setFilteredInterviews] = useState<DBInterview[]>([]);

  useEffect(() => {
    const observable = liveQuery(() => 
      db.interviews.orderBy('updatedAt').reverse().toArray()
    );
    const subscription = observable.subscribe({
      next: (result) => {
        setInterviews(result || []);
      },
      error: (error) => {
        console.error('Error in interviews live query:', error);
        setInterviews([]);
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    fetchThemes();
    fetchOccurrences();
  }, [fetchThemes, fetchOccurrences]);

  // Load occurrences for viewing interview
  useEffect(() => {
    if (viewingInterview && viewingInterview.id) {
      const loadOccurrences = async () => {
        const occs = await getOccurrencesByInterview(viewingInterview.id!);
        const occsWithColors = occs.map(occ => {
          const theme = themes.find(t => String(t.id) === String(occ.themeId));
          return {
            themeId: Number(occ.themeId),
            startIndex: occ.startIndex || 0,
            endIndex: occ.endIndex || 0,
            color: theme?.color || '#3b82f6',
          };
        });
        setViewingOccurrences(occsWithColors);
      };
      loadOccurrences();
    }
  }, [viewingInterview, themes, getOccurrencesByInterview]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      const filtered = interviews.filter(interview => 
        interview.interviewee.toLowerCase().includes(lowerQuery) ||
        interview.transcript?.toLowerCase().includes(lowerQuery) ||
        interview.location?.toLowerCase().includes(lowerQuery) ||
        interview.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
      setFilteredInterviews(filtered);
    } else {
      setFilteredInterviews(interviews);
    }
  }, [searchQuery, interviews]);

  useEffect(() => {
    if (editingInterview) {
      setInterviewee(editingInterview.interviewee);
      setPrivacyCode(editingInterview.privacyCode || '');
      setDate(editingInterview.date);
      setLocation(editingInterview.location || '');
      setType(editingInterview.type);
      setTranscript(editingInterview.transcript);
      setTags(editingInterview.tags);
    } else {
      setInterviewee('');
      setPrivacyCode('');
      setDate('');
      setLocation('');
      setType('');
      setTranscript('');
      setTags([]);
    }
  }, [editingInterview]);

  const handleCreate = () => {
    setEditingInterview(null);
    setIsFormOpen(true);
  };

  const handleEdit = (interview: DBInterview) => {
    setEditingInterview(interview);
    setIsFormOpen(true);
    setIsViewMode(false);
  };

  const handleView = async (interview: DBInterview) => {
    setViewingInterview(interview);
    setIsViewMode(true);
    setIsFormOpen(false);
    
    // Load occurrences for this interview
    if (interview.id) {
      const occs = await getOccurrencesByInterview(interview.id);
      const occsWithColors = occs.map(occ => {
        const theme = themes.find(t => String(t.id) === String(occ.themeId));
        return {
          themeId: Number(occ.themeId),
          startIndex: occ.startIndex || 0,
          endIndex: occ.endIndex || 0,
          color: theme?.color || '#3b82f6',
        };
      });
      setViewingOccurrences(occsWithColors);
    }
  };

  const handleSubmit = async () => {
    try {
      const now = new Date().toISOString();
      
      if (editingInterview && editingInterview.id) {
        // Update existing interview
        console.log('Saving interview...', { id: editingInterview.id, interviewee, transcript: transcript.substring(0, 50) + '...' });
        
        await db.interviews.update(editingInterview.id, {
          interviewee,
          privacyCode: privacyCode || undefined,
          date,
          location: location || undefined,
          type,
          transcript,
          tags: tags || [],
          updatedAt: now,
        });
        
        console.log('Interview saved successfully');
        success('Interview saved!');
        await addActivity({ type: 'interview', itemId: String(editingInterview.id), action: 'updated' });
      } else {
        // Create new interview
        console.log('Creating new interview...', { interviewee, transcript: transcript.substring(0, 50) + '...' });
        
        const interviewData: Omit<DBInterview, 'id'> = {
          interviewee: interviewee || 'Untitled Interview',
          privacyCode: privacyCode || undefined,
          date: date || new Date().toISOString(),
          location: location || undefined,
          type: type || '',
          transcript: transcript || '',
          highlights: [],
          tags: tags || [],
          createdAt: now,
          updatedAt: now,
        };
        
        const id = await db.interviews.add(interviewData);
        console.log('Interview saved successfully with ID:', id);
        success('Interview saved!');
        await addActivity({ type: 'interview', itemId: String(id), action: 'created' });
      }
      
      setIsFormOpen(false);
      setEditingInterview(null);
    } catch (error) {
      console.error('Failed to save interview:', error);
      showError('Failed to save interview');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this interview?')) {
      try {
        await db.interviews.delete(id);
        success('Interview deleted');
        await addActivity({ type: 'interview', itemId: String(id), action: 'deleted' });
      } catch (error) {
        console.error('Failed to delete interview:', error);
        showError('Failed to delete interview');
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop()?.toLowerCase();

    try {
      if (fileExtension === 'pdf') {
        // Handle PDF files
        setIsLoading(true);
        const pdfLib = await loadPdfJs();
        if (!pdfLib) {
          showError('PDF processing requires pdfjs-dist. Install with: npm install pdfjs-dist');
          setIsLoading(false);
          return;
        }
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        // Extract text from all pages
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => (item.str || ''))
            .join(' ');
          fullText += pageText + '\n\n';
        }

        setTranscript(fullText.trim());
        success(`PDF processed: ${pdf.numPages} page(s) extracted`);
        setIsLoading(false);
      } else if (fileExtension === 'txt') {
        // Handle plain text files
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          setTranscript(text);
          success('Text file loaded');
        };
        reader.onerror = () => {
          showError('Failed to read text file');
        };
        reader.readAsText(file);
      } else if (fileExtension === 'docx') {
        // Handle DOCX files - for now, show a message
        showError('DOCX files are not yet supported. Please convert to PDF or TXT first.');
      } else {
        showError('Unsupported file type. Please use PDF, TXT, or DOCX.');
      }
    } catch (error: any) {
      console.error('File upload error:', error);
      showError(`Failed to process file: ${error.message || 'Unknown error'}`);
      setIsLoading(false);
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

  const handleAcceptThemes = (newThemes: string[]) => {
    setTags([...tags, ...newThemes]);
  };

  const handleSummarize = async () => {
    if (!transcript.trim()) {
      showError('No transcript to summarize');
      return;
    }
    try {
      const summary = await summarizeContent(transcript, 'transcript');
      // You could create a note with the summary or show it in a modal
      const summaryText = `Summary:\n${summary.summary}\n\nKey Points:\n${summary.keyPoints.map(p => `- ${p}`).join('\n')}\n\nQuotes:\n${summary.quotes.map(q => `"${q}"`).join('\n')}`;
      alert(summaryText); // For now, show in alert. Could be improved with a modal
      success('Summary generated');
    } catch (err: any) {
      showError(err.message || 'Failed to generate summary');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Interviews</h1>
          <p className="mt-2 text-text-secondary text-text-secondary">
            Manage interview transcripts and highlights
          </p>
        </div>
        <Button onClick={handleCreate}>New Interview</Button>
      </div>

      <Card className="p-4">
        <Input
          placeholder="Search interviews..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </Card>

      {filteredInterviews.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-text-muted text-text-secondary">No interviews yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInterviews.map((interview) => (
            <Card
              key={interview.id}
              className="p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-text-primary text-text-primary">
                    {interview.interviewee}
                    {interview.privacyCode && (
                      <span className="ml-2 text-sm text-text-muted">({interview.privacyCode})</span>
                    )}
                  </h3>
                  <p className="text-sm text-text-secondary text-text-secondary mt-1">
                    {interview.date ? format(new Date(interview.date), 'MMM d, yyyy') : 'No date'}
                    {interview.location && ` • ${interview.location}`}
                  </p>
                  <p className="text-sm text-text-muted text-text-secondary mt-1">
                    {interview.transcript?.length || 0} characters
                    {interview.highlights && interview.highlights.length > 0 && ` • ${interview.highlights.length} highlights`}
                  </p>
                  {interview.tags && interview.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {interview.tags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </div>
                  )}
                </div>
                <div className="ml-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleView(interview)}
                  >
                    View & Tag
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleEdit(interview)}
                  >
                    Edit
                  </Button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (interview.id) {
                        handleDelete(interview.id);
                      }
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
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
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* View & Tag Modal */}
      <Modal
        isOpen={isViewMode && !!viewingInterview}
        onClose={() => {
          setIsViewMode(false);
          setViewingInterview(null);
        }}
        title={`${viewingInterview?.interviewee} - View & Tag Themes`}
        size="xl"
      >
        {viewingInterview && (
          <div className="space-y-4">
            <div className="text-sm text-text-secondary text-text-secondary">
              <p><strong>Date:</strong> {viewingInterview.date ? format(new Date(viewingInterview.date), 'MMM d, yyyy') : 'No date'}</p>
              {viewingInterview.location && <p><strong>Location:</strong> {viewingInterview.location}</p>}
              <p><strong>Type:</strong> {viewingInterview.type}</p>
            </div>
            <div className="border-t border-border-subtle border-border-default pt-4">
              <p className="text-sm font-medium text-text-primary text-text-primary mb-2">
                Select text to tag with a theme:
              </p>
              <div className="p-4 bg-bg-secondary bg-bg-secondary rounded-lg max-h-[600px] overflow-y-auto">
                {viewingInterview.id && (
                  <SelectableText
                    text={viewingInterview.transcript || ''}
                    interviewId={viewingInterview.id}
                    interviewTitle={viewingInterview.interviewee}
                    occurrences={viewingOccurrences}
                    onOccurrenceChange={async () => {
                      if (viewingInterview.id) {
                        const occs = await getOccurrencesByInterview(viewingInterview.id);
                        const occsWithColors = occs.map(occ => {
                          const theme = themes.find(t => String(t.id) === String(occ.themeId));
                          return {
                            themeId: Number(occ.themeId),
                            startIndex: occ.startIndex || 0,
                            endIndex: occ.endIndex || 0,
                            color: theme?.color || '#3b82f6',
                          };
                        });
                        setViewingOccurrences(occsWithColors);
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingInterview(null);
        }}
        title={editingInterview ? 'Edit Interview' : 'New Interview'}
        size="xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Interviewee"
              value={interviewee}
              onChange={(e) => setInterviewee(e.target.value)}
              required
            />
            <Input
              label="Privacy Code"
              value={privacyCode}
              onChange={(e) => setPrivacyCode(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <Input
              label="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <Input
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="e.g., Semi-structured, Focus group"
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-text-primary text-text-primary">
                Transcript
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSummarize}
                disabled={!transcript.trim()}
              >
                Summarize ✨
              </Button>
            </div>
            <div className="mb-2">
              <input
                type="file"
                accept=".txt,.docx,.pdf"
                onChange={handleFileUpload}
                disabled={isLoading}
                className="block w-full text-sm text-text-secondary text-text-secondary
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary-50 file:text-primary-700
                  hover:file:bg-primary-100
                  dark:file:bg-primary-900/20 dark:file:text-primary-300
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {isLoading && (
                <p className="mt-2 text-sm text-text-muted text-text-secondary">
                  Processing PDF...
                </p>
              )}
            </div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full h-64 px-3 py-2 rounded-lg border border-border-default border-border-default bg-white bg-white text-text-primary text-text-primary"
              placeholder="Paste or upload transcript..."
            />
          </div>

          <div className="space-y-4">
            {editingInterview?.id && (
              <AIThemeSuggestions
                transcript={transcript}
                interviewId={String(editingInterview.id)}
                interviewTitle={interviewee}
                onComplete={async () => {
                  // Chart will update automatically via liveQuery
                }}
              />
            )}
            <ThemeSuggestions
              content={`${interviewee} - ${type}\n\n${transcript}`}
              onAccept={handleAcceptThemes}
              existingTags={tags}
            />
          </div>

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
              setEditingInterview(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Save Interview</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
