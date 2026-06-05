import { Source } from '../types';

export type CitationFormat = 'apa' | 'mla' | 'chicago';

interface CitationData {
  authors: string[];
  year: string;
  title: string;
  journal?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
  type: Source['type'];
}

/**
 * Format author name from "Last, First" or "First Last" format
 */
function formatAuthorName(author: string): { last: string; first: string } {
  const parts = author.split(',').map(p => p.trim());
  if (parts.length === 2) {
    return { last: parts[0], first: parts[1] };
  }
  // Try "First Last" format
  const nameParts = author.trim().split(' ');
  if (nameParts.length >= 2) {
    return {
      last: nameParts[nameParts.length - 1],
      first: nameParts.slice(0, -1).join(' '),
    };
  }
  return { last: author, first: '' };
}

/**
 * Format authors for citation
 */
function formatAuthors(authors: string[], format: CitationFormat): string {
  if (authors.length === 0) return 'Unknown Author';
  
  const formatted = authors.map(author => {
    const { last, first } = formatAuthorName(author);
    if (format === 'apa' || format === 'chicago') {
      if (first) {
        const initials = first.split(' ').map(n => n[0]?.toUpperCase() || '').join('. ');
        return `${last}, ${initials}${initials ? '.' : ''}`;
      }
      return last;
    } else {
      // MLA
      if (first) {
        return `${last}, ${first}`;
      }
      return last;
    }
  });

  if (authors.length === 1) {
    return formatted[0];
  } else if (authors.length === 2) {
    return format === 'apa' ? `${formatted[0]} & ${formatted[1]}` : `${formatted[0]} and ${formatted[1]}`;
  } else {
    return `${formatted[0]} et al.`;
  }
}

/**
 * Generate APA in-text citation
 */
function generateAPAInText(data: CitationData): string {
  const authors = formatAuthors(data.authors, 'apa');
  return `(${authors}, ${data.year})`;
}

/**
 * Generate APA full citation
 */
function generateAPAFull(data: CitationData): string {
  const authors = formatAuthors(data.authors, 'apa');
  let citation = `${authors} (${data.year}). ${data.title}`;
  
  if (data.type === 'article' && data.journal) {
    citation += `. ${data.journal}`;
    if (data.volume) {
      citation += `, ${data.volume}`;
      if (data.issue) {
        citation += `(${data.issue})`;
      }
    }
    if (data.pages) {
      citation += `, ${data.pages}`;
    }
    citation += '.';
  } else if (data.type === 'book' && data.publisher) {
    citation += `. ${data.publisher}.`;
  } else if (data.type === 'website' || data.type === 'other') {
    if (data.url) {
      citation += `. ${data.url}`;
    }
  }
  
  if (data.doi) {
    citation += ` https://doi.org/${data.doi}`;
  } else if (data.url && !citation.includes(data.url)) {
    citation += ` ${data.url}`;
  }
  
  return citation;
}

/**
 * Generate MLA in-text citation
 */
function generateMLAInText(data: CitationData): string {
  const authors = formatAuthors(data.authors, 'mla');
  if (data.pages) {
    return `(${authors} ${data.pages})`;
  }
  return `(${authors})`;
}

/**
 * Generate MLA full citation
 */
function generateMLAFull(data: CitationData): string {
  const authors = formatAuthors(data.authors, 'mla');
  let citation = `${authors}. "${data.title}."`;
  
  if (data.type === 'article' && data.journal) {
    citation += ` ${data.journal}`;
    if (data.volume) {
      citation += `, vol. ${data.volume}`;
    }
    if (data.issue) {
      citation += `, no. ${data.issue}`;
    }
    if (data.pages) {
      citation += `, pp. ${data.pages}`;
    }
    citation += `, ${data.year}`;
  } else if (data.type === 'book' && data.publisher) {
    citation += ` ${data.publisher}, ${data.year}`;
  } else {
    citation += ` ${data.year}`;
  }
  
  if (data.url) {
    citation += `, ${data.url}`;
  }
  
  return citation;
}

/**
 * Generate Chicago in-text citation (footnote style)
 */
function generateChicagoInText(data: CitationData): string {
  const authors = formatAuthors(data.authors, 'chicago');
  if (data.pages) {
    return `${authors}, "${data.title}," ${data.pages}`;
  }
  return `${authors}, "${data.title}"`;
}

/**
 * Generate Chicago full citation (bibliography style)
 */
function generateChicagoFull(data: CitationData): string {
  const authors = formatAuthors(data.authors, 'chicago');
  let citation = `${authors}. "${data.title}."`;
  
  if (data.type === 'article' && data.journal) {
    citation += ` ${data.journal}`;
    if (data.volume) {
      citation += ` ${data.volume}`;
      if (data.issue) {
        citation += `, no. ${data.issue}`;
      }
    }
    if (data.pages) {
      citation += ` (${data.pages})`;
    }
    citation += ` (${data.year})`;
  } else if (data.type === 'book' && data.publisher) {
    citation += ` ${data.publisher}, ${data.year}`;
  } else {
    citation += ` ${data.year}`;
  }
  
  if (data.url) {
    citation += `. ${data.url}`;
  }
  
  return citation;
}

/**
 * Generate citation for a source
 */
export function generateFormattedCitation(
  source: Source,
  format: CitationFormat,
  type: 'in-text' | 'full'
): string {
  const year = source.date ? source.date.split('-')[0] : 'n.d.';
  
  const data: CitationData = {
    authors: source.authors,
    year,
    title: source.title,
    journal: source.journal,
    publisher: source.publisher,
    volume: source.volume,
    issue: source.issue,
    pages: source.pages,
    doi: source.doi,
    url: source.url,
    type: source.type,
  };

  if (type === 'in-text') {
    switch (format) {
      case 'apa':
        return generateAPAInText(data);
      case 'mla':
        return generateMLAInText(data);
      case 'chicago':
        return generateChicagoInText(data);
    }
  } else {
    switch (format) {
      case 'apa':
        return generateAPAFull(data);
      case 'mla':
        return generateMLAFull(data);
      case 'chicago':
        return generateChicagoFull(data);
    }
  }
}

/**
 * Generate bibliography (all sources in selected format)
 */
export function generateBibliography(sources: Source[], format: CitationFormat): string {
  return sources
    .map((source, index) => {
      const citation = generateFormattedCitation(source, format, 'full');
      return `${index + 1}. ${citation}`;
    })
    .join('\n\n');
}
