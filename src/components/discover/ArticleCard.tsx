import { useState } from 'react';
import { ArticleResult } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Icons } from '../../config/icons';
import { summarizeContent } from '../../utils/anthropic';
import { useToastStore } from '../../stores/toastStore';

interface ArticleCardProps {
  article: ArticleResult;
  thesisContext?: string;
  onAddToSources: () => void;
  isAdding?: boolean;
}

export const ArticleCard = ({ article, thesisContext, onAddToSources, isAdding = false }: ArticleCardProps) => {
  const [showFullAbstract, setShowFullAbstract] = useState(false);
  const [aiSummary, setAiSummary] = useState(article.aiSummary || '');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const { success, error: showError } = useToastStore();
  
  const handleOpenArticle = () => {
    const url = article.doi 
      ? `https://doi.org/${article.doi}` 
      : article.url || '#';
    window.open(url, '_blank');
  };
  
  const handleGenerateSummary = async () => {
    if (!article.abstract) {
      showError('No abstract available for this article');
      return;
    }
    
    setIsGeneratingSummary(true);
    try {
      const context = thesisContext 
        ? `Summarize this abstract in 1-2 sentences for a researcher studying ${thesisContext}`
        : 'Summarize this abstract in 1-2 sentences for a researcher';
      
      const contentToSummarize = `${context}\n\n${article.abstract}`;
      const summaryResult = await summarizeContent(contentToSummarize, 'source');
      setAiSummary(summaryResult.summary);
      success('Summary generated!');
    } catch (err: any) {
      showError(err.message || 'Failed to generate summary');
    } finally {
      setIsGeneratingSummary(false);
    }
  };
  
  const formatAuthors = (authors: { name: string }[]): string => {
    if (authors.length === 0) return 'Unknown Author';
    if (authors.length <= 3) {
      return authors.map(a => a.name).join(', ');
    }
    return `${authors.slice(0, 3).map(a => a.name).join(', ')}, et al.`;
  };
  
  const truncatedAbstract = article.abstract 
    ? article.abstract.length > 200 && !showFullAbstract
      ? article.abstract.substring(0, 200) + '...'
      : article.abstract
    : null;
  
  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div className="space-y-3">
        {/* Title */}
        <h3 
          className="text-lg font-semibold text-text-primary cursor-pointer hover:text-accent-gold transition-colors"
          onClick={handleOpenArticle}
        >
          {article.title}
        </h3>
        
        {/* Authors and Metadata */}
        <div className="flex items-center gap-3 flex-wrap text-sm text-text-secondary">
          <span>{formatAuthors(article.authors)}</span>
          <span>·</span>
          <span>{article.year}</span>
          {article.journal && (
            <>
              <span>·</span>
              <span className="italic">{article.journal}</span>
            </>
          )}
          {article.citationCount !== undefined && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Icons.sources size={14} />
                {article.citationCount} citations
              </span>
            </>
          )}
          {article.isOpenAccess && (
            <span className="px-2 py-0.5 bg-[#EDFBF3] text-success rounded text-xs">
              Open Access
            </span>
          )}
        </div>
        
        {/* AI Summary */}
        {aiSummary && (
          <div className="p-3 bg-accent-gold-soft rounded-lg">
            <p className="text-xs font-medium text-accent-gold-dim mb-1">
              AI Summary:
            </p>
            <p className="text-sm text-text-primary">
              {aiSummary}
            </p>
          </div>
        )}
        
        {/* Abstract */}
        {truncatedAbstract && (
          <div>
            <p className="text-sm text-text-primary leading-relaxed">
              {truncatedAbstract}
            </p>
            {article.abstract && article.abstract.length > 200 && (
              <button
                onClick={() => setShowFullAbstract(!showFullAbstract)}
                className="text-xs text-accent-gold hover:underline mt-1"
              >
                {showFullAbstract ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {article.abstract && !aiSummary && (
            <Button
              variant="ai"
              size="sm"
              onClick={handleGenerateSummary}
              disabled={isGeneratingSummary}
            >
              <Icons.ai size={14} className="mr-1" />
              {isGeneratingSummary ? 'Generating...' : 'AI Summary'}
            </Button>
          )}
          <Button
            variant={article.isAdded ? 'outline' : 'primary'}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onAddToSources();
            }}
            disabled={article.isAdded || isAdding}
            className={article.isAdded ? 'bg-[#EDFBF3] text-success border-[#6BAE8A]' : ''}
          >
            {isAdding ? 'Adding...' : article.isAdded ? (
              <>
                <Icons.check size={14} className="mr-1" />
                Added
              </>
            ) : (
              <>
                <Icons.add size={14} className="mr-1" />
                Add to Sources
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};
