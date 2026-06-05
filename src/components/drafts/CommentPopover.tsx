import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface CommentPopoverProps {
  position: { x: number; y: number };
  selectedText: string;
  onSubmit: (commentText: string) => void;
  onCancel: () => void;
}

export const CommentPopover = ({ position, selectedText, onSubmit, onCancel }: CommentPopoverProps) => {
  const [commentText, setCommentText] = useState('');

  return (
    <div
      className="fixed z-50 bg-white border border-[#EEEBE4] rounded-lg shadow-lg p-4 w-80"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="mb-2">
        <p className="text-sm text-[#7C7469] italic mb-2">
          "{selectedText}"
        </p>
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add a comment..."
          className="w-full px-3 py-2 rounded-lg border border-[#E2DDD6] bg-white text-[#1A1714] min-h-[80px]"
          autoFocus
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => {
          if (commentText.trim()) {
            onSubmit(commentText.trim());
            setCommentText('');
          }
        }}>
          Submit
        </Button>
      </div>
    </div>
  );
};
