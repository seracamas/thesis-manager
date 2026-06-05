import { ArticleResult } from '../types';

/**
 * Academic Article Search Utility
 * 
 * Searches academic articles using OpenAlex API (primary) and Semantic Scholar API (fallback).
 * Both APIs are free and don't require API keys.
 */

interface OpenAlexWork {
  id: string;
  title: string;
  authorships?: Array<{
    author: {
      display_name: string;
    };
  }>;
  publication_year?: number;
  primary_location?: {
    source?: {
      display_name?: string;
    };
    landing_page_url?: string;
  };
  abstract?: string;
  doi?: string;
  cited_by_count?: number;
  open_access?: {
    is_oa?: boolean;
    oa_url?: string;
  };
}

interface SemanticScholarPaper {
  paperId: string;
  title: string;
  authors?: Array<{
    name: string;
  }>;
  year?: number;
  venue?: string;
  abstract?: string;
  externalIds?: {
    DOI?: string;
  };
  citationCount?: number;
  openAccessPdf?: {
    url?: string;
  };
}

/**
 * Search OpenAlex API
 */
async function searchOpenAlex(
  query: string,
  filters: {
    yearFrom?: number;
    yearTo?: number;
    sourceType?: string;
  },
  sortBy: 'relevance' | 'date' | 'cited',
  page: number = 1
): Promise<{ results: ArticleResult[]; total: number }> {
  try {
    let url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=20&page=${page}`;
    
    // Add filters
    const filterParts: string[] = [];
    if (filters.yearFrom) filterParts.push(`publication_year:>=${filters.yearFrom}`);
    if (filters.yearTo) filterParts.push(`publication_year:<=${filters.yearTo}`);
    
    if (filters.sourceType) {
      // Map internal type to OpenAlex type
      const openAlexType = {
        'journal': 'journal-article',
        'conference': 'proceedings-article',
        'thesis': 'dissertation',
        'book': 'book',
      }[filters.sourceType];
      if (openAlexType) filterParts.push(`type:${openAlexType}`);
    }
    
    if (filterParts.length > 0) {
      url += `&filter=${filterParts.join(',')}`;
    }
    
    // Add sort by
    if (sortBy === 'date') {
      url += '&sort=publication_date:desc';
    } else if (sortBy === 'cited') {
      url += '&sort=cited_by_count:desc';
    }
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OpenAlex API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    const results: ArticleResult[] = (data.results || []).map((work: OpenAlexWork) => ({
      id: work.id,
      title: work.title || 'Untitled',
      authors: (work.authorships || []).slice(0, 10).map(a => ({ name: a.author.display_name })),
      year: work.publication_year || 0,
      journal: work.primary_location?.source?.display_name,
      abstract: work.abstract,
      doi: work.doi ? work.doi.replace('https://doi.org/', '') : undefined,
      url: work.primary_location?.landing_page_url || (work.doi ? `https://doi.org/${work.doi}` : undefined),
      citationCount: work.cited_by_count || 0,
      isOpenAccess: work.open_access?.is_oa || false,
    }));
    
    return { results, total: data.meta?.count || 0 };
  } catch (error) {
    console.error('Error searching OpenAlex:', error);
    throw error;
  }
}

/**
 * Search Semantic Scholar API
 */
async function searchSemanticScholar(
  query: string,
  filters: {
    yearFrom?: number;
    yearTo?: number;
    sourceType?: string;
  },
  sortBy: 'relevance' | 'date' | 'cited',
  page: number = 1
): Promise<{ results: ArticleResult[]; total: number }> {
  try {
    let url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=title,authors,year,venue,abstract,externalIds,citationCount,openAccessPdf&limit=20&offset=${(page - 1) * 20}`;
    
    // Semantic Scholar doesn't support all filters via URL, but we can filter results
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Semantic Scholar API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    let results: ArticleResult[] = (data.data || []).map((paper: SemanticScholarPaper) => ({
      id: paper.paperId,
      title: paper.title || 'Untitled',
      authors: (paper.authors || []).slice(0, 10).map(a => ({ name: a.name })),
      year: paper.year || 0,
      journal: paper.venue,
      abstract: paper.abstract,
      doi: paper.externalIds?.DOI,
      url: paper.openAccessPdf?.url || (paper.externalIds?.DOI ? `https://doi.org/${paper.externalIds.DOI}` : undefined),
      citationCount: paper.citationCount || 0,
      isOpenAccess: !!paper.openAccessPdf,
    }));
    
    // Apply filters client-side
    if (filters.yearFrom) {
      results = results.filter(r => r.year >= filters.yearFrom!);
    }
    if (filters.yearTo) {
      results = results.filter(r => r.year <= filters.yearTo!);
    }
    
    // Sort results
    if (sortBy === 'date') {
      results.sort((a, b) => b.year - a.year);
    } else if (sortBy === 'cited') {
      results.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
    }
    
    return { results, total: data.total || results.length };
  } catch (error) {
    console.error('Error searching Semantic Scholar:', error);
    throw error;
  }
}

/**
 * Main search function - tries OpenAlex first, falls back to Semantic Scholar
 */
export async function searchAcademicArticles(
  query: string,
  filters: {
    yearFrom?: number;
    yearTo?: number;
    sourceType?: string;
  } = {},
  sortBy: 'relevance' | 'date' | 'cited' = 'relevance',
  page: number = 1
): Promise<{ results: ArticleResult[]; total: number }> {
  try {
    // Try OpenAlex first
    const openAlexResults = await searchOpenAlex(query, filters, sortBy, page);
    
    // If we got good results, return them
    if (openAlexResults.results.length >= 5) {
      return openAlexResults;
    }
    
    // Otherwise, try Semantic Scholar as supplement
    try {
      const semanticResults = await searchSemanticScholar(query, filters, sortBy, page);
      
      // Combine results, removing duplicates by DOI or title
      const combined = [...openAlexResults.results];
      const existingIds = new Set(combined.map(r => r.id));
      const existingDois = new Set(combined.map(r => r.doi).filter(Boolean));
      const existingTitles = new Set(combined.map(r => r.title.toLowerCase()));
      
      for (const result of semanticResults.results) {
        if (
          !existingIds.has(result.id) &&
          (!result.doi || !existingDois.has(result.doi)) &&
          !existingTitles.has(result.title.toLowerCase())
        ) {
          combined.push(result);
        }
      }
      
      return {
        results: combined.slice(0, 20),
        total: openAlexResults.total + semanticResults.total,
      };
    } catch (semanticError) {
      // If Semantic Scholar fails, just return OpenAlex results
      console.warn('Semantic Scholar search failed, using OpenAlex results only:', semanticError);
      return openAlexResults;
    }
  } catch (error) {
    // If OpenAlex fails, try Semantic Scholar as fallback
    console.warn('OpenAlex search failed, trying Semantic Scholar:', error);
    return await searchSemanticScholar(query, filters, sortBy, page);
  }
}
