import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Icons } from '../../config/icons';
import { db, Comment } from '../../utils/db';
import { liveQuery } from 'dexie';
import clsx from 'clsx';

interface CommentsSidebarProps {
  draftId: number;
  onCommentClick?: (comment: Comment) => void;
  highlightedCommentId?: number;
}

type FilterType = 'all' | 'comments' | 'ai' | 'unresolved';

export const CommentsSidebar = ({ draftId, onCommentClick, highlightedCommentId }: CommentsSidebarProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showResolved, setShowResolved] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    const observable = liveQuery(() => 
      db.comments.where('draftId').equals(draftId).toArray()
    );
    const subscription = observable.subscribe({
      next: (result) => {
        setComments(result || []);
      },
      error: (error) => {
        console.error('Error in comments live query:', error);
        setComments([]);
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [draftId]);

  const filteredComments = comments.filter(comment => {
    if (!showResolved && comment.resolved) return false;
    if (filter === 'comments' && comment.commentType !== 'user') return false;
    if (filter === 'ai' && comment.commentType !== 'ai') return false;
    if (filter === 'unresolved' && comment.resolved) return false;
    return true;
  });

  const unresolvedCount = comments.filter(c => !c.resolved).length;

  const handleResolve = async (commentId: number) => {
    await db.comments.update(commentId, { resolved: !comments.find(c => c.id === commentId)?.resolved });
  };

  const handleReply = async (commentId: number) => {
    if (!replyText.trim()) return;
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

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
    setReplyText('');
    setReplyingTo(null);
  };

  const getCommentIcon = (commentType: string) => {
    if (commentType === 'ai') return Icons.ai;
    if (commentType === 'citation') return Icons.sources;
    return Icons.comment;
  };

  const getCommentColor = (commentType: string) => {
    if (commentType === 'ai') return 'border-accent-purple/40 bg-accent-purple/10';
    if (commentType === 'citation') return 'border-accent-slate/40 bg-accent-slate/10';
    return 'border-accent-gold/40 bg-accent-gold/10';
  };

  return (
    <div className="w-full h-full flex flex-col bg-white border-l border-[#EEEBE4]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#EEEBE4] bg-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-[#1A1714] font-playfair">Comments</h3>
          {unresolvedCount > 0 && (
            <span className="px-2 py-1 bg-[#FDF0F0] text-[#C05454] rounded-full text-xs font-medium">
              {unresolvedCount} unresolved
            </span>
          )}
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 mb-2 bg-white border-b border-[#EEEBE4] pb-2">
          <button
            onClick={() => setFilter('all')}
            className={clsx(
              'px-2 py-1 text-xs rounded transition-colors',
              filter === 'all' 
                ? 'text-[#1A1714] border-b-2 border-[#E8C96A]' 
                : 'text-[#7C7469] hover:text-[#1A1714]'
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter('comments')}
            className={clsx(
              'px-2 py-1 text-xs rounded transition-colors',
              filter === 'comments' 
                ? 'text-[#1A1714] border-b-2 border-[#E8C96A]' 
                : 'text-[#7C7469] hover:text-[#1A1714]'
            )}
            title="User Comments"
          >
            <Icons.comment size={14} />
          </button>
          <button
            onClick={() => setFilter('ai')}
            className={clsx(
              'px-2 py-1 text-xs rounded transition-colors',
              filter === 'ai' 
                ? 'text-[#1A1714] border-b-2 border-[#E8C96A]' 
                : 'text-[#7C7469] hover:text-[#1A1714]'
            )}
            title="AI Suggestions"
          >
            <Icons.ai size={14} />
          </button>
          <button
            onClick={() => setFilter('unresolved')}
            className={clsx(
              'px-2 py-1 text-xs rounded transition-colors',
              filter === 'unresolved' 
                ? 'text-[#1A1714] border-b-2 border-[#E8C96A]' 
                : 'text-[#7C7469] hover:text-[#1A1714]'
            )}
          >
            Unresolved
          </button>
        </div>
        
        <label className="flex items-center gap-2 text-sm bg-white text-[#7C7469]">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="rounded border-[#E2DDD6]"
          />
          <span>Show resolved</span>
        </label>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto bg-white">
        {filteredComments.length === 0 ? (
          <div className="empty-state py-8 bg-white">
            <Icons.comment size={48} className="text-[#E2DDD6]" />
            <p className="text-[#B5AFA8] mt-2">No comments yet</p>
          </div>
        ) : (
          filteredComments.map((comment) => {
            const Icon = getCommentIcon(comment.commentType);
            return (
              <div
                key={comment.id}
                className={clsx(
                  'bg-white border border-[#EEEBE4] rounded-xl p-4 mx-4 my-2',
                  highlightedCommentId === comment.id && 'ring-2 ring-[#E8C96A]',
                  comment.resolved && 'opacity-60'
                )}
                onClick={() => onCommentClick?.(comment)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-[#B5AFA8]" />
                    <span className="text-sm font-medium text-[#1A1714]">
                      {comment.authorName}
                    </span>
                    <span className="text-xs text-[#B5AFA8]">
                      {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  {comment.resolved && (
                    <Icons.success size={14} className="text-[#5A9E76]" />
                  )}
                </div>

                <p className="text-xs italic text-[#7C7469] mb-2">
                  "{comment.selectedText}"
                </p>

                <p className="text-sm text-[#1A1714] mb-2">
                  {comment.commentText}
                </p>

                {comment.suggestionType && (
                  <span className="inline-block px-2 py-1 bg-[#F5F0FF] text-[#8B6FCC] rounded text-xs mb-2 uppercase">
                    {comment.suggestionType}
                  </span>
                )}

                {comment.revisedText && (
                  <div className="mb-2 p-2 bg-[#F7F5F0] rounded text-sm">
                    <p className="text-xs text-[#7C7469] mb-1">Suggested revision:</p>
                    <p className="text-[#1A1714]">{comment.revisedText}</p>
                  </div>
                )}

                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="ml-4 mt-2 space-y-2 border-l-2 border-[#EEEBE4] pl-3">
                    {comment.replies.map((reply, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="font-medium text-[#7C7469]">{reply.author}</span>
                        <span className="text-xs text-[#B5AFA8] ml-2">
                          {format(new Date(reply.createdAt), 'MMM d, h:mm a')}
                        </span>
                        <p className="text-[#7C7469] mt-1">{reply.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply input */}
                {replyingTo === comment.id ? (
                  <div className="mt-2 space-y-2">
                    <Input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply..."
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleReply(comment.id!)}>
                        Reply
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setReplyingTo(null);
                        setReplyText('');
                      }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setReplyingTo(comment.id!)}
                    >
                      Reply
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleResolve(comment.id!)}
                    >
                      {comment.resolved ? (
                        <>
                          <Icons.close size={14} className="mr-1" />
                          Unresolve
                        </>
                      ) : (
                        <>
                          <Icons.check size={14} className="mr-1" />
                          Resolve
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
