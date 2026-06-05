import Cite from 'citation-js';
import type { ParsedCitation } from './citationParser';

export type CitationStyle = 'apa' | 'mla' | 'chicago' | 'harvard' | 'ieee' | 'vancouver';
export type CitationType = 'full' | 'in-text';

/**
 * Extract DOI from URL
 */
function extractDOI(url: string): string | null {
  const doiPatterns = [
    /doi\.org\/(10\.\d{4,}\/[-._;()\/:a-zA-Z0-9]+)/i,
    /doi[:\s]+(10\.\d{4,}\/[-._;()\/:a-zA-Z0-9]+)/i,
    /(10\.\d{4,}\/[-._;()\/:a-zA-Z0-9]+)/,
  ];

  for (const pattern of doiPatterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }

  return null;
}

/**
 * Fetch metadata from CrossRef API (free, no API key needed)
 */
async function fetchFromCrossRef(doi: string): Promise<any> {
  try {
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ResearchManager/1.0 (mailto:support@example.com)',
      },
    });

    if (!response.ok) {
      throw new Error(`CrossRef API error: ${response.status}`);
    }

    const data = await response.json();
    return data.message;
  } catch (error) {
    console.error('CrossRef fetch error:', error);
    throw error;
  }
}

/**
 * Convert CrossRef data to citation-js format
 */
function crossrefToCitationData(crossrefData: any): any {
  const authors = (crossrefData.author || []).map((author: any) => ({
    family: author.family || '',
    given: author.given ? (Array.isArray(author.given) ? author.given.join(' ') : author.given) : '',
  }));

  const publishedDate = crossrefData.published?.['date-parts']?.[0] || 
                       crossrefData['published-print']?.['date-parts']?.[0] ||
                       crossrefData['published-online']?.['date-parts']?.[0];

  return {
    title: crossrefData.title?.[0] || '',
    author: authors.length > 0 ? authors : undefined,
    issued: publishedDate ? { 'date-parts': [publishedDate] } : undefined,
    'container-title': crossrefData['container-title']?.[0] || crossrefData['short-container-title']?.[0] || '',
    volume: crossrefData.volume,
    issue: crossrefData.issue,
    page: crossrefData.page,
    DOI: crossrefData.DOI,
    URL: crossrefData.URL || (crossrefData.DOI ? `https://doi.org/${crossrefData.DOI}` : undefined),
    publisher: crossrefData.publisher,
    type: crossrefData.type === 'journal-article' ? 'article-journal' : 
          crossrefData.type === 'book' ? 'book' :
          crossrefData.type === 'book-chapter' ? 'chapter' :
          'article',
  };
}

/**
 * Generate citation from parsed citation data
 */
export function generateCitation(
  parsed: ParsedCitation,
  style: CitationStyle = 'apa',
  type: CitationType = 'full'
): string {
  try {
    // Build citation data object
    const citationData: any = {
      title: parsed.title,
      author: parsed.authors.map((author) => {
        const parts = author.split(',').map((p) => p.trim());
        if (parts.length === 2) {
          return { family: parts[0], given: parts[1] };
        }
        const nameParts = author.trim().split(' ');
        if (nameParts.length >= 2) {
          return {
            family: nameParts[nameParts.length - 1],
            given: nameParts.slice(0, -1).join(' '),
          };
        }
        return { literal: author };
      }),
      issued: parsed.date ? { 'date-parts': [[parsed.date.split('-')[0]]] } : undefined,
      'container-title': parsed.journal,
      publisher: parsed.publisher,
      volume: parsed.volume,
      issue: parsed.issue,
      page: parsed.pages,
      DOI: parsed.doi,
      URL: parsed.url,
    };

    // Map source type
    const typeMap: Record<string, string> = {
      article: 'article-journal',
      book: 'book',
      website: 'webpage',
      thesis: 'thesis',
      conference: 'paper-conference',
      other: 'article',
    };

    citationData.type = typeMap[parsed.type] || 'article';

    const citation = new Cite(citationData);
    const formatted = citation.format('bibliography', {
      format: 'text',
      template: style,
      lang: 'en-US',
    });

    const fullCitation = Array.isArray(formatted) ? formatted[0] || '' : formatted || '';
    return formatCitation(fullCitation, style, type, citationData);
  } catch (error: any) {
    console.error('Citation generation error:', error);
    return formatManualCitation(parsed, style, type);
  }
}

/**
 * Generate a citation from a URL using CrossRef API (legacy - use parseCitation + generateCitation instead)
 */
export async function generateCitationFromUrl(
  url: string,
  style: CitationStyle = 'apa',
  type: CitationType = 'full'
): Promise<string> {
  try {
    // Method 1: Try CrossRef API for DOIs (most reliable and accurate)
    const doi = extractDOI(url);
    if (doi) {
      try {
        const crossrefData = await fetchFromCrossRef(doi);
        const citationData = crossrefToCitationData(crossrefData);
        
        // Validate we have at least a title
        if (!citationData.title || citationData.title.trim() === '') {
          throw new Error('No title found in CrossRef data');
        }

        const citation = new Cite(citationData);
        const formatted = citation.format('bibliography', {
          format: 'text',
          template: style,
          lang: 'en-US',
        });
        const result = Array.isArray(formatted) ? formatted[0] || '' : formatted || '';
        if (result && result.trim() && !result.toLowerCase().includes('unknown')) {
          return formatCitation(result, style, type, citationData);
        }
      } catch (e: any) {
        console.log('CrossRef method failed:', e.message);
        // Continue to other methods
      }
    }

    // Method 2: Try citation-js with DOI URL
    if (doi) {
      try {
        const doiUrl = `https://doi.org/${doi}`;
        const citation = await Cite.async(doiUrl);
        const formatted = citation.format('bibliography', {
          format: 'text',
          template: style,
          lang: 'en-US',
        });
        const result = Array.isArray(formatted) ? formatted[0] || '' : formatted || '';
        if (result && result.trim() && !result.toLowerCase().includes('unknown')) {
          const citationData = await citation.get();
          return formatCitation(result, style, type, citationData[0] || {});
        }
      } catch (e) {
        // Continue
      }
    }

    // Method 3: Try direct URL with citation-js
    try {
      const citation = await Cite.async(url);
      const formatted = citation.format('bibliography', {
        format: 'text',
        template: style,
        lang: 'en-US',
      });
      const result = Array.isArray(formatted) ? formatted[0] || '' : formatted || '';
      if (result && result.trim() && !result.toLowerCase().includes('unknown')) {
        const citationData = await citation.get();
        return formatCitation(result, style, type, citationData[0] || {});
      }
    } catch (e) {
      // Continue
    }

    // Method 4: Try arXiv
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('arxiv.org')) {
        const arxivId = url.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?)/);
        if (arxivId) {
          const arxivUrl = `https://arxiv.org/abs/${arxivId[1]}`;
          const citation = await Cite.async(arxivUrl);
          const formatted = citation.format('bibliography', {
            format: 'text',
            template: style,
            lang: 'en-US',
          });
          const result = Array.isArray(formatted) ? formatted[0] || '' : formatted || '';
          if (result && result.trim()) {
            const citationData = await citation.get();
            return formatCitation(result, style, type, citationData[0] || {});
          }
        }
      }
    } catch (e) {
      // Continue
    }

    // If all methods fail, throw error to trigger fallback
    throw new Error('Could not auto-detect citation from URL');
  } catch (error: any) {
    console.error('Citation generation error:', error);
    throw error;
  }
}

/**
 * Generate a citation from source data
 */
export function generateCitationFromData(
  data: {
    title: string;
    authors: string[];
    date: string;
    type: string;
    url?: string;
  },
  style: CitationStyle = 'apa',
  type: CitationType = 'full'
): string {
  try {
    // Build citation data object
    const citationData: any = {
      title: data.title,
      author: data.authors.map((author) => {
        // Parse "Last, First" or "First Last" format
        const parts = author.split(',').map((p) => p.trim());
        if (parts.length === 2) {
          return { family: parts[0], given: parts[1] };
        }
        // Try to split "First Last"
        const nameParts = author.trim().split(' ');
        if (nameParts.length >= 2) {
          return {
            family: nameParts[nameParts.length - 1],
            given: nameParts.slice(0, -1).join(' '),
          };
        }
        return { literal: author };
      }),
      issued: data.date ? { 'date-parts': [[data.date.split('-')[0]]] } : undefined,
      URL: data.url,
    };

    // Map source type to citation type
    const typeMap: Record<string, string> = {
      article: 'article-journal',
      book: 'book',
      website: 'webpage',
      thesis: 'thesis',
      conference: 'paper-conference',
      other: 'article',
    };

    citationData.type = typeMap[data.type] || 'article';

    const citation = new Cite(citationData);
    const formatted = citation.format('bibliography', {
      format: 'text',
      template: style,
      lang: 'en-US',
    });

    const fullCitation = Array.isArray(formatted) ? formatted[0] || '' : formatted || '';
    return formatCitation(fullCitation, style, type, citationData);
  } catch (error: any) {
    console.error('Citation generation error:', error);
    // Fallback to manual format
    return formatManualCitation(data, style, type);
  }
}

/**
 * Format citation based on type (full or in-text)
 */
function formatCitation(
  fullCitation: string,
  style: CitationStyle,
  type: CitationType,
  citationData: any
): string {
  if (type === 'full') {
    return fullCitation;
  }

  // Generate in-text citation
  return formatInTextCitation(citationData, style);
}

/**
 * Format in-text citation
 */
function formatInTextCitation(data: any, style: CitationStyle): string {
  const authors = data.author || [];
  const year = data.issued?.['date-parts']?.[0]?.[0] || data.year || new Date().getFullYear();
  
  let authorStr = '';
  if (Array.isArray(authors) && authors.length > 0) {
    const firstAuthor = authors[0];
    if (authors.length === 1) {
      authorStr = firstAuthor.family || firstAuthor.literal || 'Unknown';
    } else if (authors.length === 2) {
      const first = authors[0].family || authors[0].literal || '';
      const second = authors[1].family || authors[1].literal || '';
      authorStr = style === 'apa' ? `${first} & ${second}` : `${first} and ${second}`;
    } else {
      authorStr = `${authors[0].family || authors[0].literal} et al.`;
    }
  } else if (data.authors && Array.isArray(data.authors) && data.authors.length > 0) {
    // Handle string array of authors
    const firstAuthor = data.authors[0].split(',')[0].trim();
    if (data.authors.length === 1) {
      authorStr = firstAuthor;
    } else if (data.authors.length === 2) {
      const secondAuthor = data.authors[1].split(',')[0].trim();
      authorStr = style === 'apa' ? `${firstAuthor} & ${secondAuthor}` : `${firstAuthor} and ${secondAuthor}`;
    } else {
      authorStr = `${firstAuthor} et al.`;
    }
  } else {
    // Try to extract from title or use URL domain as fallback
    authorStr = 'Unknown';
  }

  switch (style) {
    case 'apa':
      return `(${authorStr}, ${year})`;
    case 'mla':
      return `(${authorStr} ${year})`;
    case 'chicago':
      return `(${authorStr} ${year})`;
    case 'harvard':
      return `(${authorStr} ${year})`;
    case 'ieee':
      return `[${authorStr}, ${year}]`;
    case 'vancouver':
      return `(${authorStr} ${year})`;
    default:
      return `(${authorStr}, ${year})`;
  }
}

/**
 * Fallback manual citation formatting
 */
function formatManualCitation(
  data: {
    title: string;
    authors: string[];
    date: string;
    type: string;
    url?: string;
  },
  style: CitationStyle,
  type: CitationType = 'full'
): string {
  const year = data.date ? data.date.split('-')[0] : 'n.d.';
  const authorsStr = data.authors.length > 0 ? data.authors.join(', ') : 'Unknown Author';
  const journal = 'journal' in data ? data.journal : undefined;
  const publisher = 'publisher' in data ? data.publisher : undefined;
  const volume = 'volume' in data ? data.volume : undefined;
  const issue = 'issue' in data ? data.issue : undefined;
  const pages = 'pages' in data ? data.pages : undefined;

  // In-text citation
  if (type === 'in-text') {
    const firstAuthor = data.authors.length > 0 
      ? data.authors[0].split(',')[0].trim()
      : 'Unknown';
    const authorDisplay = data.authors.length > 1 
      ? `${firstAuthor} et al.`
      : firstAuthor;

    switch (style) {
      case 'apa':
      case 'harvard':
      case 'chicago':
        return `(${authorDisplay}, ${year})`;
      case 'mla':
        return `(${authorDisplay} ${year})`;
      case 'ieee':
        return `[${authorDisplay}, ${year}]`;
      case 'vancouver':
        return `(${authorDisplay} ${year})`;
      default:
        return `(${authorDisplay}, ${year})`;
    }
  }

  // Full citation with proper formatting
  switch (style) {
    case 'apa':
      const apaJournal = journal ? ` ${journal}` : '';
      const apaVolume = volume ? `, ${volume}` : '';
      const apaIssue = issue ? `(${issue})` : '';
      const apaPages = pages ? `, ${pages}` : '';
      return `${authorsStr} (${year}). ${data.title}.${apaJournal}${apaVolume}${apaIssue}${apaPages}${data.url ? `. ${data.url}` : ''}`;
    case 'mla':
      const mlaJournal = journal ? ` ${journal},` : '';
      const mlaVolume = volume ? ` vol. ${volume},` : '';
      const mlaIssue = issue ? ` no. ${issue},` : '';
      const mlaPages = pages ? ` pp. ${pages},` : '';
      return `${authorsStr}. "${data.title}."${mlaJournal}${mlaVolume}${mlaIssue}${mlaPages} ${year}${data.url ? `, ${data.url}` : ''}`;
    case 'chicago':
      const chicagoJournal = journal ? ` ${journal}` : '';
      const chicagoVolume = volume ? ` ${volume},` : '';
      const chicagoIssue = issue ? ` no. ${issue}` : '';
      const chicagoPages = pages ? ` (${pages})` : '';
      return `${authorsStr}. "${data.title}."${chicagoJournal}${chicagoVolume}${chicagoIssue}${chicagoPages} (${year})${data.url ? `. ${data.url}` : ''}`;
    case 'harvard':
      return `${authorsStr} ${year}, ${data.title}, ${publisher || journal || ''}${data.url ? `, viewed ${new Date().toLocaleDateString()}, <${data.url}>` : ''}`;
    case 'ieee':
      return `${authorsStr}, "${data.title}," ${journal || ''}${volume ? `, vol. ${volume}` : ''}${issue ? `, no. ${issue}` : ''}${pages ? `, pp. ${pages}` : ''}, ${year}${data.url ? `. [Online]. Available: ${data.url}` : ''}`;
    case 'vancouver':
      return `${authorsStr}. ${data.title}. ${journal || publisher || ''}${year ? `. ${year}` : ''}${volume ? `;${volume}` : ''}${issue ? `(${issue})` : ''}${pages ? `:${pages}` : ''}${data.url ? `. [cited ${new Date().toLocaleDateString()}]. Available from: ${data.url}` : ''}`;
    default:
      return `${authorsStr} (${year}). ${data.title}${journal ? `. ${journal}` : ''}${data.url ? `. ${data.url}` : ''}`;
  }
}

/**
 * Get available citation styles
 */
export function getCitationStyles(): Array<{ value: CitationStyle; label: string }> {
  return [
    { value: 'apa', label: 'APA (American Psychological Association)' },
    { value: 'mla', label: 'MLA (Modern Language Association)' },
    { value: 'chicago', label: 'Chicago' },
    { value: 'harvard', label: 'Harvard' },
    { value: 'ieee', label: 'IEEE' },
    { value: 'vancouver', label: 'Vancouver' },
  ];
}
