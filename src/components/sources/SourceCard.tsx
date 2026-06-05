import { Source } from '../../types';
import { Card } from '../ui/Card';
import { Tag } from '../ui/Tag';
import { Button } from '../ui/Button';
import { Icons } from '../../config/icons';
import { format } from 'date-fns';
import { generateFormattedCitation, type CitationFormat } from '../../utils/citationFormatter';
import { useToastStore } from '../../stores/toastStore';

interface SourceCardProps {
  source: Source;
  citationFormat: CitationFormat;
  onSelect: (source: Source) => void;
  onDelete: (id: string) => void;
}

export const SourceCard = ({ source, citationFormat, onSelect, onDelete }: SourceCardProps) => {
  const { success } = useToastStore();

  const handleCopyCitation = async (type: 'in-text' | 'full') => {
    try {
      const citation = generateFormattedCitation(source, citationFormat, type);
      await navigator.clipboard.writeText(citation);
      success('Citation copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy citation:', err);
    }
  };

  const formatAuthorDisplay = (authors: string[]): string => {
    return authors.map(author => {
      const parts = author.split(',').map(p => p.trim());
      if (parts.length === 2) {
        const [last, first] = parts;
        const initials = first.split(' ').map(n => n[0]?.toUpperCase() || '').join('. ');
        return `${last}, ${initials}${initials ? '.' : ''}`;
      }
      return author;
    }).join(', ');
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="card-title mb-2">
            {source.title}
          </h3>
          
          <p className="text-secondary text-text-secondary mb-2">
            {formatAuthorDisplay(source.authors)}
          </p>
          
          <div className="flex items-center gap-3 mb-2">
            <Tag variant="accent" size="sm">
              {source.type || 'Article'}
            </Tag>
            {source.year && (
              <span className="text-muted text-text-secondary">
                {source.year}
              </span>
            )}
            {source.journal && (
              <span className="text-muted text-text-muted italic">
                {source.journal}
              </span>
            )}
          </div>

          {source.summary && (
            <div className="mt-3 p-3 rounded-input bg-bg-hover">
              <p className="text-muted font-medium text-text-primary mb-1">
                Summary:
              </p>
              <p className="text-secondary text-text-secondary leading-relaxed">
                {source.summary}
              </p>
            </div>
          )}

          {source.tags && source.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {source.tags.map((tag) => (
                <Tag key={tag} variant="default">
                  {tag}
                </Tag>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleCopyCitation('in-text');
              }}
            >
              <Icons.copy size={14} className="inline mr-1" />
              In-Text
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleCopyCitation('full');
              }}
            >
              <Icons.copy size={14} className="inline mr-1" />
              Full Citation
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(source);
              }}
            >
              <Icons.edit size={14} className="inline mr-1" />
              Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Delete this source?')) {
                  onDelete(source.id);
                }
              }}
            >
              <Icons.delete size={14} className="inline mr-1" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
