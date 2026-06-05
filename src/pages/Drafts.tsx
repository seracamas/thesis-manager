import { useState, useEffect, useRef } from 'react';
import { useActivityStore } from '../stores';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { RichTextEditor } from '../components/editor/RichTextEditor';
import { Dropdown } from '../components/ui/Dropdown';
import { format } from 'date-fns';
import { liveQuery } from 'dexie';
import { db, Draft, Comment } from '../utils/db';
import { PDFViewer } from '../components/drafts/PDFViewer';
import { CommentToolbar } from '../components/drafts/CommentToolbar';
import { CommentPopover } from '../components/drafts/CommentPopover';
import { CommentsSidebar } from '../components/drafts/CommentsSidebar';
import { AIReviewPanel } from '../components/drafts/AIReviewPanel';
import { useToastStore } from '../stores/toastStore';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../config/icons';
import clsx from 'clsx';

// Lazy load PDF.js
let pdfjsLib: any = null;
async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  try {
    const module = await import('pdfjs-dist');
    pdfjsLib = module;
    if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
      // Use local worker from installed package to match version automatically
      pdfjsLib.GlobalWorkerOptions.workerSrc = 
        new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
    }
    return pdfjsLib;
  } catch (error) {
    console.warn('pdfjs-dist not available');
    return null;
  }
}

export const Drafts = () => {
  const { addActivity } = useActivityStore();
  const { success, error: showError } = useToastStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredDrafts, setFilteredDrafts] = useState<Draft[]>([]);
  
  // Removed detail view state - now handled by DraftDetail route
  
  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'outline' | 'draft' | 'revision' | 'final'>('draft');
  const [parentId, setParentId] = useState<number | ''>('');

  // Live query for drafts
  useEffect(() => {
    const observable = liveQuery(() => 
      db.drafts.orderBy('updatedAt').reverse().toArray()
    );
    const subscription = observable.subscribe({
      next: (result) => {
        setDrafts(result || []);
      },
      error: (error) => {
        console.error('Error in drafts live query:', error);
        setDrafts([]);
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      const filtered = drafts.filter(draft => 
        draft.title.toLowerCase().includes(lowerQuery) ||
        draft.content.toLowerCase().includes(lowerQuery)
      );
      setFilteredDrafts(filtered);
    } else {
      setFilteredDrafts(drafts);
    }
  }, [searchQuery, drafts]);

  const calculateWordCount = (text: string) => {
    const cleanText = text.replace(/<[^>]*>/g, ' ').trim();
    return cleanText ? cleanText.split(/\s+/).filter(word => word.length > 0).length : 0;
  };

  const handleUploadPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      showError('Please select a PDF file');
      return;
    }

    setUploading(true);
    try {
      const pdfLib = await loadPdfJs();
      if (!pdfLib) {
        showError('PDF processing requires pdfjs-dist');
        return;
      }

      // Set worker source - use local worker from installed package
      pdfLib.GlobalWorkerOptions.workerSrc = 
        new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Make a copy BEFORE pdfjs consumes it (pdfjs may detach the buffer)
      const bufferForParsing = arrayBuffer.slice(0);
      
      // Use bufferForParsing for pdfjs text extraction
      const pdf = await pdfLib.getDocument({ data: bufferForParsing }).promise;
      let fullText = '';
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => (item.str || ''))
          .join(' ');
        fullText += pageText + '\n\n';
      }

      const now = new Date().toISOString();
      const wordCount = calculateWordCount(fullText);
      
      // Save to IndexedDB WITHOUT storing the ArrayBuffer
      // Just save the extracted text and file metadata
      // IndexedDB struggles with large detached ArrayBuffers and we don't need
      // the raw bytes since we already have the text
      const draft: Omit<Draft, 'id'> = {
        title: file.name.replace('.pdf', ''),
        content: fullText.trim(),
        type: 'pdf',
        status: 'draft',
        wordCount,
        fileSize: file.size,
        pageCount: pdf.numPages,
        versions: [],
        sharedWith: [],
        createdAt: now,
        updatedAt: now,
      };

      const id = await db.drafts.add(draft);
      success('PDF uploaded successfully!');
      await addActivity({ type: 'draft', itemId: String(id), action: 'created' });
      
      // Navigate to draft detail view
      navigate(`/drafts/${id}`);
    } catch (error: any) {
      console.error('PDF upload error:', error);
      showError(`Failed to upload PDF: ${error.message}`);
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleCreate = () => {
    setEditingDraft(null);
    setTitle('');
    setContent('');
    setStatus('draft');
    setParentId('');
    setIsFormOpen(true);
  };

  const handleView = async (draft: Draft) => {
    navigate(`/drafts/${draft.id}`);
  };

  const handleEdit = (draft: Draft) => {
    setEditingDraft(draft);
    setTitle(draft.title);
    setContent(draft.content);
    setStatus(draft.status);
    setParentId(draft.parentId || '');
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const now = new Date().toISOString();
      const wordCount = calculateWordCount(content);

      if (editingDraft && editingDraft.id) {
        await db.drafts.update(editingDraft.id, {
          title,
          content,
          status,
          parentId: parentId || undefined,
          wordCount,
          updatedAt: now,
        });
        success('Draft updated!');
        await addActivity({ type: 'draft', itemId: String(editingDraft.id), action: 'updated' });
      } else {
        const draft: Omit<Draft, 'id'> = {
          title,
          content,
          type: 'text',
          status,
          parentId: parentId || undefined,
          wordCount,
          versions: [],
          createdAt: now,
          updatedAt: now,
        };
        const id = await db.drafts.add(draft);
        success('Draft created!');
        await addActivity({ type: 'draft', itemId: String(id), action: 'created' });
      }
      setIsFormOpen(false);
      setEditingDraft(null);
    } catch (error: any) {
      showError(`Failed to save draft: ${error.message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this draft?')) {
      try {
        await db.drafts.delete(id);
        // Also delete comments
        const comments = await db.comments.where('draftId').equals(id).toArray();
        for (const comment of comments) {
          if (comment.id) await db.comments.delete(comment.id);
        }
        success('Draft deleted');
        await addActivity({ type: 'draft', itemId: String(id), action: 'deleted' });
      } catch (error: any) {
        showError(`Failed to delete draft: ${error.message}`);
      }
    }
  };

  // Detail view is now handled by DraftDetail route - removed all detail view code
  if (false) {
    return (
      <div className="h-screen flex flex-col">
        {/* Top Bar */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle border-border-default bg-white bg-white">
          <div className="flex items-center gap-4 flex-1">
            <Button variant="outline" size="sm" onClick={() => {
              setIsDetailView(false);
              setViewingDraft(null);
            }}>
              ← Back
            </Button>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (viewingDraft.id && title !== viewingDraft.title) {
                  db.drafts.update(viewingDraft.id, { title, updatedAt: new Date().toISOString() });
                }
              }}
              className="flex-1 max-w-md"
            />
            {unresolvedCount > 0 && (
              <span className="px-2 py-1 bg-red-100 bg-red-50 text-red-700 text-red-700 rounded-full text-xs font-medium">
                {unresolvedCount} unresolved
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ai" size="sm" onClick={() => setShowAIReview(true)}>
              <Icons.ai size={14} className="mr-1" />
              AI Review
            </Button>
            {viewingDraft.type === 'pdf' && (
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                Export PDF
              </Button>
            )}
            <Button variant="outline" size="sm" disabled>
              Share
            </Button>
          </div>
        </div>

        {/* Main Content: 3-panel layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: PDF Viewer or Text Editor (60%) */}
          <div className="w-[60%] border-r border-border-subtle border-border-default relative">
            {viewingDraft.type === 'pdf' && viewingDraft.originalPDF ? (
              <PDFViewer
                pdfData={viewingDraft.originalPDF}
                comments={comments}
                onTextSelect={handleTextSelect}
                highlightedCommentId={highlightedCommentId}
              />
            ) : (
              <div className="h-full overflow-y-auto p-6">
                <RichTextEditor
                  content={viewingDraft.content}
                  onChange={(newContent) => {
                    setContent(newContent);
                    if (viewingDraft.id) {
                      db.drafts.update(viewingDraft.id, {
                        content: newContent,
                        wordCount: calculateWordCount(newContent),
                        updatedAt: new Date().toISOString(),
                      });
                    }
                  }}
                  placeholder="Start writing..."
                />
              </div>
            )}

            {/* Floating Toolbar */}
            {toolbarPosition && selectedText && !showCommentPopover && (
              <CommentToolbar
                position={toolbarPosition}
                onComment={() => setShowCommentPopover(true)}
                onAISuggest={handleAISuggest}
                onClose={() => {
                  setToolbarPosition(null);
                  setSelectedText(null);
                  window.getSelection()?.removeAllRanges();
                }}
              />
            )}

            {/* Comment Popover */}
            {showCommentPopover && selectedText && toolbarPosition && (
              <CommentPopover
                position={toolbarPosition}
                selectedText={selectedText.text}
                onSubmit={handleAddComment}
                onCancel={() => {
                  setShowCommentPopover(false);
                  setToolbarPosition(null);
                  setSelectedText(null);
                }}
              />
            )}
          </div>

          {/* Right: Comments Sidebar (40%) */}
          <div className="w-[40%]">
            {viewingDraft.id && (
              <CommentsSidebar
                draftId={viewingDraft.id}
                onCommentClick={(comment) => {
                  setHighlightedCommentId(comment.id);
                  setTimeout(() => setHighlightedCommentId(undefined), 2000);
                }}
                highlightedCommentId={highlightedCommentId}
              />
            )}
          </div>
        </div>

        {/* AI Review Panel */}
        {showAIReview && (
          <AIReviewPanel
            isOpen={showAIReview}
            onClose={() => setShowAIReview(false)}
            onReview={handleAIReview}
            content={viewingDraft.content}
          />
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Drafts</h1>
          <p className="text-text-secondary" style={{ fontSize: '14px', color: '#B0A898' }}>
            Write and manage your thesis drafts
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleUploadPDF}
            className="hidden"
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Icons.clock size={14} className="mr-1" />
                Uploading...
              </>
            ) : (
              <>
                <Icons.upload size={14} className="mr-1" />
                Upload PDF
              </>
            )}
          </Button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-xl font-semibold transition-colors"
            style={{
              background: '#E8C96A',
              color: '#111111',
              border: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#D4B44A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#E8C96A';
            }}
          >
            New Draft
          </button>
        </div>
      </div>

      <Card 
        className="p-4"
        style={{
          background: '#FAF8F3',
          border: '1px solid #E5DED0',
          borderRadius: '12px'
        }}
      >
        <Input
          placeholder="Search drafts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            background: '#FAF8F3',
            borderColor: '#E5DED0',
            color: '#111111'
          }}
        />
      </Card>

      {filteredDrafts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-text-muted text-text-secondary">No drafts yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDrafts.map((draft) => (
            <Card
              key={draft.id}
              className="p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleView(draft)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-text-primary text-text-primary">
                      {draft.title}
                    </h3>
                    {draft.type === 'pdf' && (
                      <span className="text-xs px-2 py-1 bg-blue-100 bg-blue-50 text-blue-800 text-blue-700 rounded">
                        PDF
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-1 bg-primary-100 bg-accent-gold-soft text-primary-800 text-accent-gold-dim rounded">
                      {draft.status}
                    </span>
                    <span className="text-sm text-text-muted text-text-secondary">
                      {draft.wordCount} words
                    </span>
                    {draft.versions.length > 0 && (
                      <span className="text-sm text-text-muted text-text-secondary">
                        • {draft.versions.length} versions
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted text-text-secondary mt-2">
                    {format(new Date(draft.updatedAt), 'MMM d, yyyy')}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (draft.id) handleDelete(draft.id);
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

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingDraft(null);
        }}
        title={editingDraft ? 'Edit Draft' : 'New Draft'}
        size="xl"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Dropdown
              label="Status"
              options={[
                { label: 'Outline', value: 'outline' },
                { label: 'Draft', value: 'draft' },
                { label: 'Revision', value: 'revision' },
                { label: 'Final', value: 'final' },
              ]}
              value={status}
              onChange={(value) => setStatus(value as typeof status)}
            />

            <Dropdown
              label="Parent Document (optional)"
              options={[
                { label: 'None', value: '' },
                ...drafts.filter(d => !d.parentId && d.id !== editingDraft?.id).map(d => ({
                  label: d.title,
                  value: d.id || ''
                })),
              ]}
              value={parentId}
              onChange={(value) => setParentId(value ? Number(value) : '')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary text-text-primary mb-2">
              Content
            </label>
            <RichTextEditor content={content} onChange={setContent} placeholder="Start writing..." />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => {
              setIsFormOpen(false);
              setEditingDraft(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Save Draft</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
