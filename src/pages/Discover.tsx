import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSourcesStore, useActivityStore } from '../stores';
import { useToastStore } from '../stores/toastStore';
import { useSources, checkDuplicateSource } from '../hooks/useSources';
import { searchAcademicArticles } from '../utils/academicSearch';
import type { ArticleResult } from '../types';
import { summarizeContent } from '../utils/anthropic';
import { parseCitation } from '../utils/citationParser';
import { ArticleCard } from '../components/discover/ArticleCard';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Dropdown } from '../components/ui/Dropdown';
import { SkeletonList } from '../components/ui/Skeleton';
import { db } from '../utils/db';

export const Discover = () => {
  const { sources: liveSources } = useSources();
  const { createSource } = useSourcesStore();
  const { addActivity } = useActivityStore();
  const { success, error: showError } = useToastStore();
  const navigate = useNavigate();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<ArticleResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingSourceId, setAddingSourceId] = useState<string | null>(null);
  
  // Filters
  const [yearFrom, setYearFrom] = useState<number | undefined>();
  const [yearTo, setYearTo] = useState<number | undefined>();
  const [sourceType, setSourceType] = useState<string>('');
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'cited'>('relevance');
  
  // Personalization
  const [thesisContext, setThesisContext] = useState(() => {
    return localStorage.getItem('thesisContext') || '';
  });
  
  // Check which articles are already added
  useEffect(() => {
    if (results.length > 0 && liveSources) {
      const checkDuplicates = async () => {
        const updatedResults = await Promise.all(
          results.map(async (article) => {
            const isInLiveSources = liveSources.some((source: any) => 
              (article.doi && source.doi?.toLowerCase() === article.doi.toLowerCase()) ||
              (article.url && source.url?.toLowerCase() === article.url.toLowerCase()) ||
              source.title?.toLowerCase().trim() === article.title.toLowerCase().trim()
            );
            
            const duplicate = await checkDuplicateSource(article.doi, article.url, article.title);
            return { ...article, isAdded: isInLiveSources || !!duplicate };
          })
        );
        setResults(updatedResults);
      };
      checkDuplicates();
    }
  }, [results.length, liveSources]);
  
  const handleSearch = async (page: number = 1) => {
    if (!searchQuery.trim()) {
      showError('Please enter a search query');
      return;
    }
    
    setIsLoading(true);
    setHasSearched(true);
    
    try {
      const response = await searchAcademicArticles(
        searchQuery,
        {
          yearFrom,
          yearTo,
          sourceType,
        },
        sortBy,
        page
      );
      
      const resultsWithAdded = await Promise.all(
        response.results.map(async (article) => {
          const isInLiveSources = liveSources?.some((source: any) => 
            (article.doi && source.doi?.toLowerCase() === article.doi.toLowerCase()) ||
            (article.url && source.url?.toLowerCase() === article.url.toLowerCase()) ||
            source.title?.toLowerCase().trim() === article.title.toLowerCase().trim()
          ) || false;
          
          const duplicate = await checkDuplicateSource(article.doi, article.url, article.title);
          return { ...article, isAdded: isInLiveSources || !!duplicate };
        })
      );
      
      if (page === 1) {
        setResults(resultsWithAdded);
      } else {
        setResults(prev => [...prev, ...resultsWithAdded]);
      }
      
      setTotalResults(response.total);
      setCurrentPage(page);
    } catch (err: any) {
      showError(err.message || 'Failed to search articles');
      setResults([]);
      setTotalResults(0);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLoadMore = () => {
    handleSearch(currentPage + 1);
  };
  
  const handleAddToSources = async (article: ArticleResult) => {
    if (article.isAdded || addingSourceId === article.id) {
      return;
    }
    
    setAddingSourceId(article.id);
    
    try {
      let aiSummary = '';
      if (article.abstract) {
        try {
          const context = thesisContext 
            ? `Summarize this abstract in 1-2 sentences for a researcher studying ${thesisContext}`
            : 'Summarize this abstract in 1-2 sentences for a researcher';
          
          const contentToSummarize = `${context}\n\n${article.abstract}`;
          const summaryResult = await summarizeContent(contentToSummarize, 'source');
          aiSummary = summaryResult.summary;
        } catch (err: any) {
          console.log('Could not generate summary (non-fatal):', err);
          aiSummary = article.abstract.substring(0, 200) + (article.abstract.length > 200 ? '...' : '');
        }
      }
      
      const citationUrl = article.doi 
        ? `https://doi.org/${article.doi}` 
        : article.url || '';
      
      let parsedData;
      if (citationUrl) {
        try {
          parsedData = await parseCitation(citationUrl);
        } catch (err: any) {
          console.log('Could not parse citation (non-fatal):', err);
        }
      }
      
      let sourceType: 'article' | 'book' | 'thesis' | 'conference' | 'other' = 'article';
      if (article.journal?.toLowerCase().includes('conference')) {
        sourceType = 'conference';
      } else if (article.journal?.toLowerCase().includes('thesis') || article.journal?.toLowerCase().includes('dissertation')) {
        sourceType = 'thesis';
      }
      
      const authors = article.authors.map(a => a.name);
      const date = article.year ? `${article.year}-01-01` : new Date().toISOString().split('T')[0];
      
      let citation = '';
      try {
        if (parsedData && parsedData.title) {
          try {
            const { generateCitation: formatCitation } = await import('../utils/citationFormatter');
            citation = formatCitation(
              {
                id: 'temp',
                title: parsedData.title,
                authors: parsedData.authors.length > 0 ? parsedData.authors : authors,
                date: parsedData.date || date,
                type: sourceType,
                citation: '',
                tags: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                journal: parsedData.journal,
                publisher: parsedData.publisher,
                volume: parsedData.volume,
                issue: parsedData.issue,
                pages: parsedData.pages,
                doi: parsedData.doi,
                url: parsedData.url,
              },
              'apa',
              'full'
            );
          } catch (formatErr: any) {
            console.log('Citation formatter failed, using simple format:', formatErr);
            citation = `${authors.join(', ')} (${article.year || 'n.d.'}). ${article.title}. ${article.journal || ''}`;
          }
        } else {
          citation = `${authors.join(', ')} (${article.year || 'n.d.'}). ${article.title}. ${article.journal || ''}`;
        }
      } catch (err: any) {
        console.log('Citation generation failed, using fallback:', err);
        citation = `${authors.join(', ')} (${article.year || 'n.d.'}). ${article.title}. ${article.journal || ''}`;
      }
      
      const duplicate = await checkDuplicateSource(article.doi, article.url, article.title);
      if (duplicate) {
        setResults(prev => prev.map(a => 
          a.id === article.id ? { ...a, isAdded: true } : a
        ));
        showError('This source is already in your library.');
        setAddingSourceId(null);
        return;
      }
      
      let sourceId: number;
      try {
        console.log('Adding source to database...', article.title);
        
        const sourceToAdd = {
          title: (article.title || 'Untitled').trim(),
          authors: authors.length > 0 ? authors : ['Unknown Author'],
          year: article.year || new Date().getFullYear(),
          journal: article.journal || parsedData?.journal || undefined,
          doi: article.doi || parsedData?.doi || undefined,
          url: article.url || citationUrl || undefined,
          summary: aiSummary || article.abstract || undefined,
          citationCount: article.citationCount || 0,
          type: sourceType,
          tags: [] as string[],
          createdAt: new Date().toISOString(),
        };
        
        console.log('Source data to add:', sourceToAdd);
        
        sourceId = await db.sources.add(sourceToAdd);
        
        console.log('Source added successfully with ID:', sourceId);
      } catch (err: any) {
        console.error('Error creating source:', err);
        
        setResults(prev => prev.map(a => 
          a.id === article.id ? { ...a, isAdded: false } : a
        ));
        
        if (err.name === 'ConstraintError' || 
            err.message?.includes('Database error') || 
            err.message?.includes('ConstraintError') ||
            err.message?.includes('constraint')) {
          showError('Database error. Please go to Settings → Database → Reset Database to fix this issue.');
        } else {
          showError(err.message || 'Failed to add source. Please try again.');
        }
        setAddingSourceId(null);
        return;
      }
      
      setResults(prev => prev.map(a => 
        a.id === article.id ? { ...a, isAdded: true } : a
      ));
      
      try {
        await addActivity({ type: 'source', itemId: String(sourceId), action: 'created' });
      } catch (err) {
        console.log('Failed to add activity (non-fatal):', err);
      }
      
      success(
        `Added to Sources!`,
        5000,
        {
          label: 'View in Sources',
          onClick: () => {
            navigate(`/sources?highlight=${sourceId}`);
          }
        }
      );
      
      setAddingSourceId(null);
    } catch (err: any) {
      console.error('Error adding source:', err);
      setAddingSourceId(null);
      
      setResults(prev => prev.map(a => 
        a.id === article.id ? { ...a, isAdded: false } : a
      ));
      
      if (!err.message?.includes('Database error') && !err.message?.includes('already shown')) {
        const errorMsg = err.message || 'Failed to add source. Please try again.';
        showError(errorMsg);
      }
    }
  };
  
  const handleThesisContextChange = (value: string) => {
    setThesisContext(value);
    localStorage.setItem('thesisContext', value);
  };
  
  const suggestedSearches = [
    'ADHD learning strategies',
    'educational technology',
    'cognitive development',
    'pedagogical methods',
  ];
  
  return (
    <div className="space-y-6" style={{ padding: '32px 40px', background: '#FFFFFF' }}>
      <div>
        <h1 className="page-title">Research Explorer</h1>
        <p className="mt-1 text-[14px] text-text-muted">
          Search academic articles and add them directly to your Sources
        </p>
      </div>
      
      {/* Personalization */}
      <Card className="p-5" style={{ background: '#FFFFFF', border: '1px solid #F0EBE0', borderRadius: '14px' }}>
        <Input
          label="Your research focus (optional)"
          value={thesisContext}
          onChange={(e) => handleThesisContextChange(e.target.value)}
          placeholder="e.g., ADHD learning strategies in elementary education"
          className="max-w-md"
        />
        <p className="text-xs text-text-muted mt-1">
          This helps AI generate more relevant summaries for your research
        </p>
      </Card>
      
      {/* Search Bar */}
      <Card className="p-5" style={{ background: '#FFFFFF', border: '1px solid #E5DED0', borderRadius: '14px' }}>
        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch(1);
              }
            }}
            placeholder="Search academic articles (e.g., ADHD learning strategies, educational technology)..."
            className="flex-1"
          />
          <Button onClick={() => handleSearch(1)} disabled={isLoading} style={{ padding: '12px 24px', borderRadius: '10px', fontWeight: 600 }}>
            {isLoading ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </Card>
      
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="w-32">
          <Input
            label="Year From"
            type="number"
            value={yearFrom || ''}
            onChange={(e) => setYearFrom(e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="2020"
          />
        </div>
        <div className="w-32">
          <Input
            label="Year To"
            type="number"
            value={yearTo || ''}
            onChange={(e) => setYearTo(e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="2024"
          />
        </div>
        <div className="w-48">
          <Dropdown
            label="Source Type"
            options={[
              { value: '', label: 'All Types' },
              { value: 'journal', label: 'Journal' },
              { value: 'conference', label: 'Conference' },
              { value: 'thesis', label: 'Thesis' },
              { value: 'book', label: 'Book' },
            ]}
            value={sourceType}
            onChange={setSourceType}
          />
        </div>
        <div className="w-48">
          <Dropdown
            label="Sort By"
            options={[
              { value: 'relevance', label: 'Relevance' },
              { value: 'date', label: 'Most Recent' },
              { value: 'cited', label: 'Most Cited' },
            ]}
            value={sortBy}
            onChange={(value) => setSortBy(value as 'relevance' | 'date' | 'cited')}
          />
        </div>
      </div>
      
      {/* Results */}
      {isLoading && results.length === 0 ? (
        <SkeletonList count={5} />
      ) : hasSearched && results.length === 0 ? (
        <Card className="p-12 text-center" style={{ background: '#FDFBF7', border: '1px solid #F0EBE0', borderRadius: '14px' }}>
          <p className="text-text-secondary mb-2">
            No articles found. Try broader keywords.
          </p>
          <div className="mt-4">
            <p className="text-sm text-text-muted mb-2">Suggested searches:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestedSearches.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setSearchQuery(suggestion);
                    handleSearch(1);
                  }}
                  className="px-4 py-1.5 text-sm rounded-[20px] transition-colors"
                  style={{ background: '#F5EDD8', color: '#6B6358', border: 'none' }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </Card>
      ) : results.length > 0 ? (
        <>
          <div className="text-sm text-text-secondary">
            Found {totalResults.toLocaleString()} results for "{searchQuery}"
          </div>
          
          <div className="space-y-4">
            {results.map((article) => (
              <ArticleCard
                key={article.id}
                article={{
                  ...article,
                  isAdded: article.isAdded || addingSourceId === article.id,
                }}
                thesisContext={thesisContext}
                onAddToSources={() => handleAddToSources(article)}
                isAdding={addingSourceId === article.id}
              />
            ))}
          </div>
          
          {results.length < totalResults && (
            <div className="text-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : `Load More (${totalResults - results.length} remaining)`}
              </Button>
            </div>
          )}
        </>
      ) : (
        <Card className="p-12 text-center" style={{ background: '#FDFBF7', border: '1px solid #F0EBE0', borderRadius: '14px' }}>
          <p className="text-text-secondary mb-4">
            Enter a search query to discover academic articles
          </p>
          <div>
            <p className="text-sm text-text-muted mb-2">Try searching for:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestedSearches.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setSearchQuery(suggestion);
                    handleSearch(1);
                  }}
                  className="px-4 py-1.5 text-sm rounded-[20px] transition-colors"
                  style={{ background: '#F5EDD8', color: '#6B6358', border: 'none' }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
