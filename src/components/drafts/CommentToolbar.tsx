import { Button } from '../ui/Button';
import { Icons } from '../../config/icons';

interface CommentToolbarProps {
  position: { x: number; y: number };
  onComment: () => void;
  onAISuggest: () => void;
  onClose: () => void;
}

export const CommentToolbar = ({ position, onComment, onAISuggest, onClose }: CommentToolbarProps) => {
  return (
    <div
      className="fixed z-50 bg-white border border-[#EEEBE4] rounded-lg shadow-lg p-2 flex gap-2"
      style={{
        left: `${position.x}px`,
        top: `${position.y - 50}px`,
      }}
    >
      <Button size="sm" variant="secondary" onClick={onComment}>
        <Icons.comment size={14} className="mr-1" />
        Comment
      </Button>
      <Button size="sm" variant="ai" onClick={onAISuggest}>
        <Icons.ai size={14} className="mr-1" />
        AI Suggest
      </Button>
      <button
        onClick={onClose}
        className="px-2 py-1 text-[#B5AFA8] hover:text-[#1A1714] transition-colors"
      >
        <Icons.close size={16} />
      </button>
    </div>
  );
};
