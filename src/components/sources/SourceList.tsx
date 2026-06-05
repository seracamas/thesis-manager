import { Source } from '../../types';
import { Card } from '../ui/Card';
import { Tag } from '../ui/Tag';
import { Icons } from '../../config/icons';
import { format } from 'date-fns';

interface SourceListProps {
  sources: Source[];
  onSelect: (source: Source) => void;
  onDelete: (id: string) => void;
}

export const SourceList = ({ sources, onSelect, onDelete }: SourceListProps) => {
  if (sources.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted">No sources yet</p>
        <p className="text-sm text-text-muted mt-2">
          Click "New Source" to add your first source
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sources.map((source) => (
        <Card
          key={source.id}
          className="p-4 hover:shadow-md transition-all cursor-pointer"
          style={{
            background: '#FFFFFF',
            border: '1px solid #F0EBE0',
            borderRadius: '16px',
          }}
          onClick={() => onSelect(source)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 
                className="text-lg font-semibold"
                style={{ 
                  fontFamily: 'Playfair Display, serif',
                  color: '#111111' 
                }}
              >
                {source.title}
              </h3>
              <p className="text-sm mt-1" style={{ color: '#6B6358' }}>
                {source.authors.join(', ')}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span 
                  className="text-xs px-2 py-1 rounded"
                  style={{ 
                    background: '#F5EDD8', 
                    color: '#6B6358' 
                  }}
                >
                  {source.type || 'Article'}
                </span>
                {source.year && (
                  <span className="text-xs" style={{ color: '#6B6358' }}>
                    {source.year}
                  </span>
                )}
              </div>
              {source.tags && source.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {source.tags.map((tag) => (
                    <Tag key={tag} variant="default">
                      {tag}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Delete this source?')) {
                  onDelete(source.id);
                }
              }}
              className="ml-4 p-2 rounded transition-colors"
              style={{
                color: '#D4696B'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#FFF0F0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Icons.delete size={20} />
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
};
