import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PDFViewer } from '../components/drafts/PDFViewer';
import { CommentToolbar } from '../components/drafts/CommentToolbar';
import { CommentPopover } from '../components/drafts/CommentPopover';
import { CommentsSidebar } from '../components/drafts/CommentsSidebar';
import { useToastStore } from '../stores/toastStore';
import { db, Draft, Comment } from '../utils/db';
import { liveQuery } from 'dexie';
import { Icons } from '../config/icons';

export const SharedDraft = () => {
  const { shareLink } = useParams<{ shareLink: string }>();
  const { success, error: showError } = useToastStore();
  
  const [draft, setDraft] = useState<Draft | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [guestName, setGuestName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  
  // Commenting state
  const [selectedText, setSelectedText] = useState<{ text: string; pageNumber: number; y: number } | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number } | null>(null);
  const [showCommentPopover, setShowCommentPopover] = useState(false);
  const [highlightedCommentId, setHighlightedCommentId] = useState<number | undefined>();
  
  // Load draft by shareLink
  useEffect(() => {
    if (!shareLink) return;
    
    const loadDraft = async () => {
      try {
        const loadedDraft = await db.drafts.where('shareLink').equals(shareLink).first();
        if (!loadedDraft) {
          showError('Shared draft not found');
          return;
        }
        setDraft(loadedDraft);
        setIsLoading(false);
        
        // Check if user has set a guest name
        const savedName = localStorage.getItem('guestName');
        if (savedName) {
          setGuestName(savedName);
        } else {
          setShowNameInput(true);
        }
      } catch (err: any) {
        showError(`Failed to load draft: ${err.message}`);
        setIsLoading(false);
      }
    };
    
    loadDraft();
  }, [shareLink, showError]);
  
  // Live query for comments
  useEffect(() => {
    if (!draft?.id) return;
    const observable = liveQuery(() => 
      db.comments.where('draftId').equals(draft.id!).toArray()
    );
    const subscription = observable.subscribe({
      next: (result) => setComments(result || []),
      error: () => setComments([])
    });
    return () => subscription.unsubscribe();
  }, [draft?.id]);
  
  const handleSetName = () => {
    if (!guestName.trim()) return;
    localStorage.setItem('guestName', guestName.trim());
    setShowNameInput(false);
  };
  
  const handleTextSelect = (text: string, pageNumber: number, positionY: number) => {
    // Check if user can comment (for now, allow if they have a name)
    if (!guestName.trim()) {
      setShowNameInput(true);
      return;
    }
    
    setSelectedText({ text, pageNumber, y: positionY });
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setToolbarPosition({ x: rect.left + rect.width / 2, y: rect.top });
    }
  };
  
  const handleAddComment = async (commentText: string) => {
    if (!draft?.id || !selectedText || !guestName.trim()) return;
    
    try {
      const comment: Omit<Comment, 'id'> = {
        draftId: draft.id,
        selectedText: selectedText.text,
        commentText,
        pageNumber: draft.type === 'pdf' ? selectedText.pageNumber : undefined,
        positionY: selectedText.y,
        resolved: false,
        authorName: guestName.trim(),
        replies: [],
        commentType: 'user',
        createdAt: new Date().toISOString(),
      };
      
      await db.comments.add(comment);
      success('Comment added!');
      setShowCommentPopover(false);
      setToolbarPosition(null);
      setSelectedText(null);
      window.getSelection()?.removeAllRanges();
    } catch (err: any) {
      showError(`Failed to add comment: ${err.message}`);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-[#7C7469]">Loading shared draft...</p>
      </div>
    );
  }
  
  if (!draft) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <p className="text-[#C05454] mb-2">Draft not found</p>
          <p className="text-sm text-[#B5AFA8]">This shared link may be invalid or expired.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 border-b border-[#EEEBE4] bg-white">
        <div className="flex items-center gap-4 flex-1">
          <h1 className="text-xl font-semibold text-[#1A1714] font-playfair">
            {draft.title}
          </h1>
          <span className="px-2 py-1 bg-[#FBF6E8] text-[#B8920A] rounded-full text-xs font-medium">
            Shared View
          </span>
        </div>
        {showNameInput && (
          <div className="flex items-center gap-2">
            <Input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Your name"
              className="w-48"
              onKeyPress={(e) => e.key === 'Enter' && handleSetName()}
            />
            <Button onClick={handleSetName} size="sm">
              Set Name
            </Button>
          </div>
        )}
        {!showNameInput && guestName && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#7C7469]">Commenting as: {guestName}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                localStorage.removeItem('guestName');
                setGuestName('');
                setShowNameInput(true);
              }}
            >
              Change
            </Button>
          </div>
        )}
      </div>
      
      {/* Main Content: 2-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: PDF Viewer or Text Display (60%) */}
        <div className="w-[60%] border-r border-[#EEEBE4] relative bg-white">
          {draft.type === 'pdf' ? (
            // PDF viewer not available - original PDF file is not stored
            // Display extracted text instead
            <div className="h-full overflow-y-auto p-6">
              <div className="prose max-w-none whitespace-pre-wrap">
                {draft.content}
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-6">
              <div
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: draft.content }}
              />
            </div>
          )}
          
          {/* Floating Toolbar (only show if name is set) */}
          {toolbarPosition && selectedText && !showCommentPopover && guestName.trim() && (
            <CommentToolbar
              position={toolbarPosition}
              onComment={() => setShowCommentPopover(true)}
              onAISuggest={() => {
                // AI suggest not available in shared view
                setToolbarPosition(null);
                setSelectedText(null);
                window.getSelection()?.removeAllRanges();
              }}
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
          <CommentsSidebar
            draftId={draft.id!}
            onCommentClick={(comment) => {
              setHighlightedCommentId(comment.id);
              setTimeout(() => setHighlightedCommentId(undefined), 2000);
            }}
            highlightedCommentId={highlightedCommentId}
          />
        </div>
      </div>
    </div>
  );
};
