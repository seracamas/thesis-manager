import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { RichTextEditor } from '../components/editor/RichTextEditor';
// Removed unused imports - using inline components now
import { AIReviewPanel } from '../components/drafts/AIReviewPanel';
import {
  ArgumentIntegrityPanel,
  type ArgumentIntegrityResult,
} from '../components/drafts/ArgumentIntegrityPanel';
import { DeepReviewPanel } from '../components/drafts/DeepReviewPanel';
import { useToastStore } from '../stores/toastStore';
import { db, Draft, Comment } from '../utils/db';
import { liveQuery } from 'dexie';
import { Icons } from '../config/icons';
import clsx from 'clsx';
import { callClaude, getProxyHeaders, getUsageFromResponse } from '../utils/claudeClient';
import { incrementUsage } from '../utils/anthropic';
import {
  type DeepReviewResults,
  type DimensionCommentsResult,
  type DeepReviewOverall,
  DEEP_REVIEW_PROMPTS,
  DEEP_REVIEW_MAX_DRAFT_CHARS,
  stripHtml,
  parseClaudeJson,
  extractAllQuotes,
} from '../utils/deepReview';

export const DraftDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error: showError } = useToastStore();
  
  const [draft, setDraft] = useState<Draft | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Commenting state
  const [selectionData, setSelectionData] = useState<{ text: string; positionX: number; positionY: number } | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [highlightedCommentId, setHighlightedCommentId] = useState<number | undefined>();
  const [aiLoading, setAiLoading] = useState(false);
  
  // Modals
  const [showAIReview, setShowAIReview] = useState(false);
  const [showArgumentCheck, setShowArgumentCheck] = useState(false);
  const [showDeepReviewPanel, setShowDeepReviewPanel] = useState(false);
  const [isDeepReviewing, setIsDeepReviewing] = useState(false);
  const [deepReviewResults, setDeepReviewResults] = useState<DeepReviewResults | null>(null);
  const [deepReviewProgress, setDeepReviewProgress] = useState(0);
  const [deepReviewQuotes, setDeepReviewQuotes] = useState<string[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'viewer' | 'commenter'>('commenter');
  
  // Load draft
  useEffect(() => {
    if (!id) return;
    const loadDraft = async () => {
      try {
        const draftId = Number(id);
        const loadedDraft = await db.drafts.get(draftId);
        if (!loadedDraft) {
          showError('Draft not found');
          navigate('/drafts');
          return;
        }
        setDraft(loadedDraft);
        setTitle(loadedDraft.title);
        setContent(loadedDraft.content);
        setIsLoading(false);
      } catch (err: any) {
        showError(`Failed to load draft: ${err.message}`);
        navigate('/drafts');
      }
    };
    loadDraft();
  }, [id, navigate, showError]);
  
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
  
  // Close toolbar when clicking outside (but not on toolbar buttons)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking on the toolbar or its buttons
      if (target.closest('[data-toolbar]')) {
        return;
      }
      if (showToolbar && !target.closest('#document-content')) {
        setShowToolbar(false);
        setSelectionData(null);
      }
    };
    
    if (showToolbar) {
      // Use a small delay to avoid closing immediately when clicking the button
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showToolbar]);

  useEffect(() => {
    if (!isDeepReviewing) {
      if (deepReviewResults) {
        setDeepReviewProgress(100);
      }
      return;
    }

    setDeepReviewProgress(0);
    const start = Date.now();
    const duration = 30000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setDeepReviewProgress(Math.min(95, (elapsed / duration) * 100));
    }, 200);

    return () => clearInterval(interval);
  }, [isDeepReviewing, deepReviewResults]);
  
  const calculateWordCount = (text: string) => {
    const cleanText = text.replace(/<[^>]*>/g, ' ').trim();
    return cleanText ? cleanText.split(/\s+/).filter(word => word.length > 0).length : 0;
  };
  
  const handleTitleUpdate = async () => {
    if (!draft?.id || title === draft.title) return;
    try {
      await db.drafts.update(draft.id, { 
        title, 
        updatedAt: new Date().toISOString() 
      });
    } catch (err: any) {
      showError(`Failed to update title: ${err.message}`);
    }
  };
  
  const handleContentUpdate = async (newContent: string) => {
    if (!draft?.id) return;
    setContent(newContent);
    try {
      await db.drafts.update(draft.id, {
        content: newContent,
        wordCount: calculateWordCount(newContent),
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      showError(`Failed to update content: ${err.message}`);
    }
  };
  
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionData(null);
      setShowToolbar(false);
      return;
    }
    
    const selectedText = selection.toString().trim();
    if (selectedText.length < 2) {
      setSelectionData(null);
      setShowToolbar(false);
      return;
    }
    
    // Get position of selection for toolbar placement
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    setSelectionData({
      text: selectedText,
      positionX: rect.left + rect.width / 2,
      positionY: rect.top - 10,
    });
    setShowToolbar(true);
  };
  
  const openCommentBox = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setShowToolbar(false);
    setShowCommentBox(true);
    // Keep selection data so the comment box can show the selected text
  };
  
  const handleSubmitComment = async () => {
    if (!newCommentText.trim() || !draft?.id) return;
    
    try {
      const comment: Omit<Comment, 'id'> = {
        draftId: draft.id,
        selectedText: selectionData?.text || '',
        commentText: newCommentText.trim(),
        positionY: 0,
        resolved: false,
        authorName: 'You',
        replies: [],
        commentType: 'user',
        createdAt: new Date().toISOString(),
      };
      
      await db.comments.add(comment);
      success('Comment added!');
      setNewCommentText('');
      setShowCommentBox(false);
      setSelectionData(null);
      window.getSelection()?.removeAllRanges();
    } catch (err: any) {
      showError(`Failed to add comment: ${err.message}`);
    }
  };
  
  const handleAddGeneralComment = () => {
    setSelectionData({ text: '', positionX: 0, positionY: 0 });
    setShowCommentBox(true);
  };
  
  const handleAISuggest = async () => {
    if (!selectionData?.text || !draft?.id) return;
    setShowToolbar(false);
    setAiLoading(true);
    
    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: getProxyHeaders(),
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Analyze this selected passage from an academic draft and give 2-3 specific improvement suggestions.
            
Selected text: "${selectionData.text}"

Return ONLY a JSON array, no markdown:
[{ 
  "type": "clarity" | "tone" | "argument" | "evidence",
  "issue": "what is wrong",
  "suggestion": "how to fix it",
  "revisedText": "optional improved version"
}]`
          }],
          system: 'You are an expert academic writing coach helping a PhD student improve their thesis. Be specific and constructive. Return only valid JSON.',
          max_tokens: 1000
        })
      });
      
      if (!response.ok) throw new Error('AI request failed');
      const data = await response.json();
      const text = data.content[0].type === 'text' ? data.content[0].text : '';
      const clean = text.replace(/```json|```/g, '').trim();
      const suggestions = JSON.parse(clean);
      
      // Add AI suggestions as special comments
      for (const s of suggestions) {
        const comment: Omit<Comment, 'id'> = {
          draftId: draft.id,
          selectedText: selectionData.text,
          commentText: `${s.issue} → ${s.suggestion}`,
          revisedText: s.revisedText || undefined,
          positionY: 0,
          resolved: false,
          authorName: 'AI Assistant',
          replies: [],
          commentType: 'ai',
          suggestionType: s.type,
          createdAt: new Date().toISOString(),
        };
        await db.comments.add(comment);
      }
      
      success('AI suggestions added!');
      
    } catch (error: any) {
      console.error('AI suggest error:', error);
      showError('AI suggestion failed. Make sure the proxy server is running.');
    } finally {
      setAiLoading(false);
      setSelectionData(null);
      window.getSelection()?.removeAllRanges();
    }
  };
  
  // Render content with highlighted commented text
  const renderContentWithHighlights = () => {
    if (!draft) return '';

    const sourceContent = content || draft.content;
    const activeComments = comments.filter(c => c.selectedText && !c.resolved);
    const hasHighlights = activeComments.length > 0 || deepReviewQuotes.length > 0;

    if (!hasHighlights) {
      return sourceContent;
    }

    const escapeHtml = (text: string) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    let renderedContent = escapeHtml(stripHtml(sourceContent));

    if (activeComments.length > 0) {
      const sortedComments = [...activeComments].sort((a, b) =>
        (b.selectedText?.length || 0) - (a.selectedText?.length || 0)
      );

      sortedComments.forEach((comment) => {
        if (comment.selectedText && comment.id) {
          const escapedText = escapeHtml(comment.selectedText);
          const regex = new RegExp(`(${escapedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          renderedContent = renderedContent.replace(regex, (match) => {
            return `<span 
            data-comment-id="${comment.id}" 
            class="highlight-comment bg-[#FBF6E8] border-b-2 border-[#E8C96A] cursor-pointer rounded-sm px-0.5 hover:bg-[#FCF5E0] transition-colors"
          >${match}</span>`;
          });
        }
      });
    }

    if (deepReviewQuotes.length > 0) {
      const sortedQuotes = [...deepReviewQuotes].sort((a, b) => b.length - a.length);
      sortedQuotes.forEach((quote) => {
        const escapedText = escapeHtml(quote);
        const regex = new RegExp(`(${escapedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        renderedContent = renderedContent.replace(regex, (match) => {
          return `<mark class="deep-review-mark bg-yellow-200/70 border-b-2 border-yellow-400 rounded-sm px-0.5">${match}</mark>`;
        });
      });
    }

    return renderedContent;
  };
  
  // Add click handlers to highlighted spans after render
  useEffect(() => {
    const handleHighlightClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('highlight-comment')) {
        const commentId = target.getAttribute('data-comment-id');
        if (commentId) {
          const commentEl = document.getElementById(`comment-${commentId}`);
          if (commentEl) {
            commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
              commentEl.classList.add('ring-2', 'ring-[#E8C96A]', 'rounded-xl');
              setTimeout(() => {
                commentEl.classList.remove('ring-2', 'ring-[#E8C96A]');
              }, 2000);
            }, 100);
          }
        }
      }
    };
    
    const docContent = document.getElementById('document-content');
    if (docContent) {
      docContent.addEventListener('click', handleHighlightClick);
      return () => {
        docContent.removeEventListener('click', handleHighlightClick);
      };
    }
  }, [comments]);
  
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };
  
  const handleReply = async (commentId: number, replyText: string) => {
    if (!replyText.trim()) return;
    
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    
    try {
      await db.comments.update(commentId, {
        replies: [
          ...(comment.replies || []),
          {
            text: replyText.trim(),
            author: 'You',
            createdAt: new Date().toISOString(),
          }
        ]
      });
      success('Reply added!');
    } catch (err: any) {
      showError(`Failed to add reply: ${err.message}`);
    }
  };
  
  const handleResolve = async (commentId: number) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    
    try {
      await db.comments.update(commentId, { resolved: !comment.resolved });
      success(comment.resolved ? 'Comment unresolved' : 'Comment resolved');
    } catch (err: any) {
      showError(`Failed to update comment: ${err.message}`);
    }
  };
  
  const handleAIReview = async (content: string): Promise<{
    strengths: string[];
    improvements: string[];
    gaps: string[];
    toneAssessment: string;
  }> => {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: getProxyHeaders(),
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: `Review this thesis draft section:\n\n${content}\n\nIdentify:\n1. The 3 strongest parts of the argument\n2. The 3 areas that need the most improvement\n3. Any gaps in evidence or logic\n4. Overall academic tone assessment\n\nReturn as JSON: {"strengths": ["string"], "improvements": ["string"], "gaps": ["string"], "toneAssessment": "string"}`
        }],
        system: 'You are an academic writing assistant helping a PhD student improve their thesis.',
        max_tokens: 2048,
      }),
    });
    
    if (!response.ok) throw new Error('AI review failed');
    const data = await response.json();
    const textContent = data.content[0].type === 'text' ? data.content[0].text : '';
    let jsonText = textContent.trim();
    if (jsonText.startsWith('```json')) jsonText = jsonText.substring(7);
    if (jsonText.startsWith('```')) jsonText = jsonText.substring(3);
    if (jsonText.endsWith('```')) jsonText = jsonText.substring(0, jsonText.length - 3);
    jsonText = jsonText.trim();
    
    return JSON.parse(jsonText);
  };

  const handleArgumentCheck = async (draftContent: string): Promise<ArgumentIntegrityResult> => {
    const response = await callClaude({
      messages: [{
        role: 'user',
        content: `Analyze this thesis draft section for argument integrity.

Draft:
${draftContent}

Return ONLY JSON:
{
  "unsupportedClaims": [{"claim": "string", "suggestion": "string"}],
  "logicGaps": [{"description": "string", "location": "string"}],
  "strengthScore": number,
  "strengthRationale": "string",
  "topSuggestion": "string"
}`,
      }],
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
    });

    const usage = getUsageFromResponse(response);
    incrementUsage(usage.inputTokens + usage.outputTokens);

    if (!response.content?.[0] || response.content[0].type !== 'text') {
      throw new Error('Unexpected response from AI');
    }

    let jsonText = response.content[0].text.trim();
    if (jsonText.startsWith('```json')) jsonText = jsonText.substring(7);
    if (jsonText.startsWith('```')) jsonText = jsonText.substring(3);
    if (jsonText.endsWith('```')) jsonText = jsonText.substring(0, jsonText.length - 3);
    jsonText = jsonText.trim();

    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse argument analysis');
    }

    return JSON.parse(jsonMatch[0]);
  };

  const runDeepReviewCall = async <T,>(prompt: string): Promise<T> => {
    const plainText = stripHtml(content);
    const draftExcerpt = plainText.length > DEEP_REVIEW_MAX_DRAFT_CHARS
      ? `${plainText.slice(0, DEEP_REVIEW_MAX_DRAFT_CHARS)}\n\n[Draft truncated for analysis]`
      : plainText;

    const response = await callClaude({
      messages: [{
        role: 'user',
        content: `${prompt}\n\nDraft:\n${draftExcerpt}`,
      }],
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
    });

    const usage = getUsageFromResponse(response);
    incrementUsage(usage.inputTokens + usage.outputTokens);

    if (!response.content?.[0] || response.content[0].type !== 'text') {
      throw new Error('Unexpected response from AI');
    }

    return parseClaudeJson<T>(response.content[0].text);
  };

  const handleDeepReview = async () => {
    if (!content.trim()) {
      showError('Add draft content before running a deep review');
      return;
    }

    setIsDeepReviewing(true);
    setDeepReviewProgress(0);
    setDeepReviewResults(null);
    setDeepReviewQuotes([]);
    setShowDeepReviewPanel(true);

    const dimensionLabels = {
      argument: 'Argument & Logic',
      evidence: 'Evidence & Citations',
      structure: 'Structure & Flow',
      style: 'Academic Tone & Style',
    };

    const settled = await Promise.allSettled([
      runDeepReviewCall<{ comments: DimensionCommentsResult['comments'] }>(DEEP_REVIEW_PROMPTS.argument),
      runDeepReviewCall<{ comments: DimensionCommentsResult['comments'] }>(DEEP_REVIEW_PROMPTS.evidence),
      runDeepReviewCall<{ comments: DimensionCommentsResult['comments'] }>(DEEP_REVIEW_PROMPTS.structure),
      runDeepReviewCall<{ comments: DimensionCommentsResult['comments'] }>(DEEP_REVIEW_PROMPTS.style),
      runDeepReviewCall<DeepReviewOverall>(DEEP_REVIEW_PROMPTS.overall),
    ]);

    const failedDimensions: string[] = [];

    const getDimensionResult = (
      index: number,
      label: string
    ): DimensionCommentsResult => {
      const result = settled[index];
      if (result.status === 'fulfilled') {
        return { comments: result.value.comments || [] };
      }
      failedDimensions.push(label);
      return {
        comments: [],
        error: result.reason?.message || 'Analysis failed',
      };
    };

    const overallResult = settled[4];
    let overall: DeepReviewOverall;
    if (overallResult.status === 'fulfilled') {
      overall = overallResult.value;
    } else {
      failedDimensions.push('Overall Assessment');
      overall = {
        overallScore: 0,
        summary: '',
        topStrengths: [],
        topWeaknesses: [],
        priorityRevisions: [],
        error: overallResult.reason?.message || 'Overall assessment failed',
      };
    }

    const results: DeepReviewResults = {
      argument: getDimensionResult(0, dimensionLabels.argument),
      evidence: getDimensionResult(1, dimensionLabels.evidence),
      structure: getDimensionResult(2, dimensionLabels.structure),
      style: getDimensionResult(3, dimensionLabels.style),
      overall,
      failedDimensions,
    };

    setDeepReviewResults(results);
    setDeepReviewQuotes(extractAllQuotes(results));
    setDeepReviewProgress(100);
    setIsDeepReviewing(false);

    if (failedDimensions.length === 5) {
      showError('Deep review failed. Check that the proxy server is running and your API key is configured.');
    } else if (failedDimensions.length > 0) {
      showError(`Deep review partially completed. Failed: ${failedDimensions.join(', ')}`);
    }
  };
  
  const handleExportPDF = async () => {
    // PDF export not available - original PDF file is not stored
    // Only extracted text is stored to avoid ArrayBuffer detachment issues
    showError('PDF export not available. The original PDF file is not stored, only the extracted text.');
  };
  
  const handleGenerateShareLink = async () => {
    if (!draft?.id) return;
    
    try {
      const shareLink = crypto.randomUUID();
      await db.drafts.update(draft.id, { shareLink });
      setDraft({ ...draft, shareLink });
      success('Share link generated!');
    } catch (err: any) {
      showError(`Failed to generate share link: ${err.message}`);
    }
  };
  
  const handleCopyShareLink = async () => {
    if (!draft?.shareLink) return;
    
    const shareUrl = `${window.location.origin}/shared/${draft.shareLink}`;
    await navigator.clipboard.writeText(shareUrl);
    success('Share link copied to clipboard!');
  };
  
  const handleInviteByEmail = async () => {
    if (!draft?.id || !shareEmail.trim()) return;
    
    try {
      const sharedWith = draft.sharedWith || [];
      const existingIndex = sharedWith.findIndex(s => s.email === shareEmail.trim());
      
      if (existingIndex >= 0) {
        sharedWith[existingIndex] = {
          email: shareEmail.trim(),
          role: shareRole,
          addedAt: new Date().toISOString(),
        };
      } else {
        sharedWith.push({
          email: shareEmail.trim(),
          role: shareRole,
          addedAt: new Date().toISOString(),
        });
      }
      
      await db.drafts.update(draft.id, { sharedWith });
      setDraft({ ...draft, sharedWith });
      setShareEmail('');
      success('Invitation sent!');
    } catch (err: any) {
      showError(`Failed to invite: ${err.message}`);
    }
  };
  
  const handleRemoveAccess = async (email: string) => {
    if (!draft?.id) return;
    
    try {
      const sharedWith = (draft.sharedWith || []).filter(s => s.email !== email);
      await db.drafts.update(draft.id, { sharedWith });
      setDraft({ ...draft, sharedWith });
      success('Access removed');
    } catch (err: any) {
      showError(`Failed to remove access: ${err.message}`);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-text-secondary">Loading draft...</p>
      </div>
    );
  }
  
  if (!draft) {
    return null;
  }
  
  const unresolvedCount = comments.filter(c => !c.resolved).length;
  
  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 border-b border-[#EEEBE4] bg-white">
        <div className="flex items-center gap-4 flex-1">
          <Button variant="secondary" size="sm" onClick={() => navigate('/drafts')}>
            <Icons.next size={16} className="mr-1 rotate-180" />
            Back
          </Button>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleUpdate}
            className="flex-1 max-w-md"
            placeholder="Draft title"
          />
          {unresolvedCount > 0 && (
            <span className="bg-[#FDF3F3] text-[#C05454] text-[12px] font-semibold px-3 py-1 rounded-full border border-[#EDCFCF]">
              {unresolvedCount} unresolved
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDeepReview}
            disabled={!content.trim() || isDeepReviewing}
            className="relative"
          >
            {isDeepReviewing ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
                Reviewing...
              </>
            ) : (
              <>🔬 Deep Review</>
            )}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowArgumentCheck(true)}
            disabled={!content.trim()}
          >
            🔍 Check Argument
          </Button>
          <Button variant="ai" size="sm" onClick={() => setShowAIReview(true)}>
            <Icons.ai size={14} className="mr-1" />
            AI Review
          </Button>
          {/* PDF export removed - original PDF not stored */}
          <Button variant="secondary" size="sm" onClick={() => setShowShareModal(true)}>
            <Icons.external size={14} className="mr-1" />
            Share
          </Button>
        </div>
      </div>
      
      {/* Main Content: 3-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Document Viewer (55%) */}
        <div className="w-[55%] border-r border-[#EEEBE4] relative bg-white">
          <div 
            id="document-content"
            onMouseUp={handleTextSelection}
            className="h-full overflow-y-auto p-6 prose max-w-none text-[#1A1714] leading-relaxed text-[14px] select-text cursor-text"
            dangerouslySetInnerHTML={{ __html: renderContentWithHighlights() }}
          />
          
          {/* Floating Toolbar */}
          {showToolbar && selectionData && (
            <div
              data-toolbar
              style={{
                position: 'fixed',
                top: `${selectionData.positionY - 45}px`,
                left: `${selectionData.positionX - 80}px`,
                zIndex: 50,
              }}
              className="bg-white border border-[#EEEBE4] rounded-xl shadow-lg px-2 py-1.5 flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openCommentBox(e);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-[#1A1714] hover:bg-[#F7F5F0] transition-colors"
              >
                <Icons.comment size={14} className="text-[#7C7469]" />
                Comment
              </button>
              <div className="w-px h-4 bg-[#EEEBE4]" />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAISuggest();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                disabled={aiLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-[#7C68CC] hover:bg-[#F5F1FF] transition-colors disabled:opacity-50"
              >
                <Icons.ai size={14} />
                {aiLoading ? 'Loading...' : 'AI Suggest'}
              </button>
            </div>
          )}
        </div>
        
        {/* Right: Comments Sidebar (45%) */}
        <div className="w-[45%] bg-white border-l border-[#EEEBE4] flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-[#EEEBE4] bg-white">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[#1A1714] font-playfair">Comments</h3>
              <Button
                size="sm"
                variant="primary"
                onClick={handleAddGeneralComment}
                className="flex items-center gap-1.5"
              >
                <Icons.add size={14} />
                Add Comment
              </Button>
            </div>
          </div>
          
          {/* Comment Input Box */}
          {showCommentBox && (
            <div className="bg-white border-b border-[#EEEBE4] p-4">
              {selectionData?.text ? (
                <p className="text-[12px] text-[#7C7469] italic mb-3 border-l-2 border-[#E8C96A] pl-3 leading-relaxed">
                  "{selectionData.text}"
                </p>
              ) : (
                <p className="text-[12px] text-[#7C7469] italic mb-3">
                  General comment (no selection)
                </p>
              )}
              
              <textarea
                autoFocus
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="w-full bg-[#F7F5F0] border border-[#E2DDD6] rounded-lg px-3 py-2 text-[13px] text-[#1A1714] placeholder-[#C5BFB8] resize-none focus:outline-none focus:border-[#E8C96A] focus:ring-2 focus:ring-[#E8C96A]/15"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSubmitComment();
                  }
                }}
              />
              
              <p className="text-[11px] text-[#C5BFB8] mt-1 mb-3">
                Cmd+Enter to submit
              </p>
              
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowCommentBox(false);
                    setNewCommentText('');
                    setSelectionData(null);
                  }}
                  className="px-4 py-1.5 rounded-lg text-[13px] text-[#7C7469] hover:bg-[#F7F5F0] border border-[#E2DDD6]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitComment}
                  disabled={!newCommentText.trim()}
                  className="px-4 py-1.5 rounded-lg text-[13px] font-semibold bg-[#E8C96A] text-[#1A1714] hover:bg-[#D9B84F] disabled:opacity-40"
                >
                  Comment
                </button>
              </div>
            </div>
          )}
          
          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {comments.length === 0 ? (
              <div className="text-center py-12">
                <Icons.comment size={32} className="text-[#E2DDD6] mx-auto mb-3" />
                <p className="text-[13px] text-[#B5AFA8] italic">
                  Select any text in the document to add a comment
                </p>
              </div>
            ) : (
              comments.map((comment) => {
                const isAI = comment.commentType === 'ai';
                return (
                  <div
                    key={comment.id}
                    id={`comment-${comment.id}`}
                    className={clsx(
                      'rounded-xl p-4 mb-3 border transition-all',
                      comment.resolved && 'opacity-40',
                      isAI
                        ? 'bg-[#F5F1FF] border-[#DDD0FF]'
                        : 'bg-white border-[#EEEBE4] shadow-sm'
                    )}
                  >
                    {/* Author + time */}
                    <div className="flex items-center gap-2 mb-2">
                      {isAI ? (
                        <span className="flex items-center gap-1 text-[12px] font-semibold text-[#7C68CC]">
                          <Icons.ai size={12} /> AI Suggestion
                        </span>
                      ) : (
                        <span className="text-[12px] font-semibold text-[#1A1714]">
                          {comment.authorName}
                        </span>
                      )}
                      <span className="text-[11px] text-[#B5AFA8] ml-auto">
                        {formatRelativeTime(comment.createdAt)}
                      </span>
                    </div>
                    
                    {/* Type badge for AI comments */}
                    {isAI && comment.suggestionType && (
                      <span className="text-[10px] uppercase tracking-wider bg-[#EDE5FF] text-[#7C68CC] px-2 py-0.5 rounded-full mb-2 inline-block">
                        {comment.suggestionType}
                      </span>
                    )}
                    
                    {/* Selected text quote */}
                    {comment.selectedText && (
                      <p className="text-[12px] text-[#7C7469] italic mb-2 border-l-2 border-[#E8C96A] pl-2 leading-relaxed">
                        "{comment.selectedText}"
                      </p>
                    )}
                    
                    {/* Comment text */}
                    <p className="text-[13px] text-[#1A1714] mb-2">
                      {comment.commentText}
                    </p>
                    
                    {/* Apply suggestion button */}
                    {isAI && comment.revisedText && (
                      <button
                        onClick={() => {
                          // Apply the revision to the document
                          const newContent = content.replace(
                            comment.selectedText,
                            comment.revisedText!
                          );
                          handleContentUpdate(newContent);
                          success('Suggestion applied!');
                        }}
                        className="text-[12px] text-[#7C68CC] border border-[#DDD0FF] bg-white px-3 py-1 rounded-lg hover:bg-[#F5F1FF] mt-1"
                      >
                        Apply Suggestion
                      </button>
                    )}
                  
                  {/* Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="ml-3 border-l border-[#EEEBE4] pl-3 mb-2 space-y-2">
                      {comment.replies.map((reply, idx) => (
                        <div key={idx}>
                          <span className="text-[11px] font-semibold text-[#7C7469]">{reply.author}</span>
                          <p className="text-[12px] text-[#1A1714]">{reply.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Reply input */}
                  <input
                    placeholder="Reply..."
                    className="w-full bg-[#F7F5F0] border border-[#E2DDD6] rounded-lg px-3 py-1.5 text-[12px] text-[#1A1714] placeholder-[#C5BFB8] focus:outline-none focus:border-[#E8C96A] mb-2"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        handleReply(comment.id!, e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  
                  {/* Resolve button */}
                  {!comment.resolved && (
                    <button
                      onClick={() => handleResolve(comment.id!)}
                      className="text-[11px] text-[#5A9E76] hover:underline flex items-center gap-1"
                    >
                      <Icons.check size={11} /> Resolve
                    </button>
                  )}
                </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      
      {/* AI Review Panel */}
      {showAIReview && (
        <AIReviewPanel
          isOpen={showAIReview}
          onClose={() => setShowAIReview(false)}
          onReview={handleAIReview}
          content={draft.content}
        />
      )}

      {showArgumentCheck && (
        <ArgumentIntegrityPanel
          isOpen={showArgumentCheck}
          onClose={() => setShowArgumentCheck(false)}
          onAnalyze={handleArgumentCheck}
          content={content}
        />
      )}

      <DeepReviewPanel
        isOpen={showDeepReviewPanel}
        onClose={() => {
          setShowDeepReviewPanel(false);
          setDeepReviewQuotes([]);
        }}
        results={deepReviewResults}
        isLoading={isDeepReviewing}
        progress={deepReviewProgress}
        draftTitle={title || draft.title}
      />
      
      {/* Share Modal */}
      <Modal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share Draft"
        size="lg"
      >
        <div className="space-y-6">
          {/* Share via link */}
          <div>
            <h3 className="text-sm font-semibold text-[#1A1714] mb-3">Share via link</h3>
            {!draft.shareLink ? (
              <Button onClick={handleGenerateShareLink} variant="primary">
                Generate Share Link
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={`${window.location.origin}/shared/${draft.shareLink}`}
                    readOnly
                    className="flex-1"
                  />
                  <Button onClick={handleCopyShareLink} variant="secondary">
                    <Icons.copy size={14} className="mr-1" />
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-[#B5AFA8]">
                  Anyone with this link can view the draft
                </p>
              </div>
            )}
          </div>
          
          {/* Invite by email */}
          <div>
            <h3 className="text-sm font-semibold text-[#1A1714] mb-3">Invite by email</h3>
            <div className="flex gap-2 mb-3">
              <Input
                type="email"
                placeholder="email@example.com"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className="flex-1"
              />
              <select
                value={shareRole}
                onChange={(e) => setShareRole(e.target.value as 'viewer' | 'commenter')}
                className="px-3 py-2 rounded-xl border border-[#E2DDD6] bg-[#F7F5F0] text-[#1A1714] text-sm"
              >
                <option value="viewer">Can view</option>
                <option value="commenter">Can comment</option>
              </select>
              <Button onClick={handleInviteByEmail} variant="primary">
                Invite
              </Button>
            </div>
            
            {/* Shared with list */}
            {draft.sharedWith && draft.sharedWith.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-[#B5AFA8] mb-2">People with access:</p>
                {draft.sharedWith.map((person, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-[#F7F5F0] rounded-lg"
                  >
                    <div>
                      <p className="text-sm text-[#1A1714]">{person.email}</p>
                      <p className="text-xs text-[#B5AFA8]">
                        {person.role === 'commenter' ? 'Can comment' : 'Can view'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAccess(person.email)}
                    >
                      <Icons.delete size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
