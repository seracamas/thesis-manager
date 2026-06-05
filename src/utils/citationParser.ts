import Cite from 'citation-js';
import { extractInfoWithClaude } from './anthropic';

export interface ParsedCitation {
  title: string;
  authors: string[];
  date: string;
  journal?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
  type: 'article' | 'book' | 'website' | 'thesis' | 'conference' | 'other';
  abstract?: string;
  keywords?: string[];
}

/**
 * Extract DOI from URL or text
 */
function extractDOI(input: string): string | null {
  const doiPatterns = [
    /doi\.org\/(10\.\d{4,}\/[-._;()\/:a-zA-Z0-9]+)/i,
    /doi[:\s]+(10\.\d{4,}\/[-._;()\/:a-zA-Z0-9]+)/i,
    /(10\.\d{4,}\/[-._;()\/:a-zA-Z0-9]+)/,
  ];

  for (const pattern of doiPatterns) {
    const match = input.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }

  return null;
}

/**
 * Fetch metadata from CrossRef API
 */
async function fetchFromCrossRef(doi: string): Promise<any> {
  try {
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ResearchManager/1.0',
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
 * Parse citation from CrossRef data
 */
function parseCrossRefData(crossrefData: any, url?: string): ParsedCitation {
  const authors = (crossrefData.author || []).map((author: any) => {
    const family = author.family || '';
    const given = author.given ? (Array.isArray(author.given) ? author.given.join(' ') : author.given) : '';
    return given ? `${family}, ${given}` : family;
  });

  const publishedDate = crossrefData.published?.['date-parts']?.[0] || 
                       crossrefData['published-print']?.['date-parts']?.[0] ||
                       crossrefData['published-online']?.['date-parts']?.[0];

  const year = publishedDate?.[0] || '';
  const month = publishedDate?.[1] || '';
  const day = publishedDate?.[2] || '';
  
  let dateStr = '';
  if (year) {
    if (month && day) {
      dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else if (month) {
      dateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    } else {
      dateStr = `${year}-01-01`;
    }
  }

  return {
    title: crossrefData.title?.[0] || '',
    authors: authors.length > 0 ? authors : [],
    date: dateStr,
    journal: crossrefData['container-title']?.[0] || crossrefData['short-container-title']?.[0] || '',
    publisher: crossrefData.publisher || '',
    volume: crossrefData.volume?.toString(),
    issue: crossrefData.issue?.toString(),
    pages: crossrefData.page,
    doi: crossrefData.DOI,
    url: url || (crossrefData.DOI ? `https://doi.org/${crossrefData.DOI}` : undefined),
    type: crossrefData.type === 'journal-article' ? 'article' :
          crossrefData.type === 'book' ? 'book' :
          crossrefData.type === 'book-chapter' ? 'book' :
          crossrefData.type === 'thesis' ? 'thesis' :
          'article',
    abstract: crossrefData.abstract ? (typeof crossrefData.abstract === 'string' ? crossrefData.abstract : crossrefData.abstract.replace(/<[^>]*>/g, '')) : undefined,
    keywords: crossrefData.subject || [],
  };
}

/**
 * Extract PubMed ID from URL
 */
function extractPubMedID(input: string): string | null {
  const patterns = [
    /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i,
    /ncbi\.nlm\.nih\.gov\/pubmed\/(\d+)/i,
    /pmid[:\s]+(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Fetch metadata from PubMed API
 */
async function fetchFromPubMed(pmId: string): Promise<any> {
  try {
    const response = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmId}&retmode=json`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`PubMed API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.result?.[pmId];
    return result;
  } catch (error) {
    console.error('PubMed fetch error:', error);
    throw error;
  }
}

/**
 * Parse citation from PubMed data
 */
function parsePubMedData(pubmedData: any, url?: string): ParsedCitation {
  const authors = (pubmedData.authors || []).map((author: any) => {
    return `${author.name || ''}`;
  }).filter(Boolean);

  const pubDate = pubmedData.pubdate || '';
  const yearMatch = pubDate.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : '';
  const dateStr = year ? `${year}-01-01` : '';

  return {
    title: pubmedData.title || '',
    authors: authors,
    date: dateStr,
    journal: pubmedData.source || '',
    publisher: pubmedData.publisher || '',
    volume: pubmedData.volume,
    issue: pubmedData.issue,
    pages: pubmedData.pages,
    doi: pubmedData.elocationid || undefined,
    url: url,
    type: 'article',
    abstract: pubmedData.abstract || undefined,
    keywords: [],
  };
}

/**
 * Parse citation from URL or citation text
 */
export async function parseCitation(input: string): Promise<ParsedCitation> {
  // Check if it's a URL
  let isUrl = false;
  try {
    new URL(input);
    isUrl = true;
  } catch {
    // Not a URL, treat as citation text
  }

  // Method 1: Try PubMed API
  const pmId = extractPubMedID(input);
  if (pmId) {
    try {
      console.log('Trying PubMed API for ID:', pmId);
      const pubmedData = await fetchFromPubMed(pmId);
      const parsed = parsePubMedData(pubmedData, isUrl ? input : undefined);
      if (parsed.title && parsed.title.trim() !== '') {
        console.log('Successfully parsed from PubMed');
        return parsed;
      }
    } catch (e: any) {
      console.log('PubMed failed:', e.message);
    }
  }

  // Method 2: Try CrossRef API for DOIs
  const doi = extractDOI(input);
  if (doi) {
    try {
      console.log('Trying CrossRef API for DOI:', doi);
      const crossrefData = await fetchFromCrossRef(doi);
      const parsed = parseCrossRefData(crossrefData, isUrl ? input : undefined);
      if (parsed.title && parsed.title.trim() !== '') {
        console.log('Successfully parsed from CrossRef');
        return parsed;
      }
    } catch (e: any) {
      console.log('CrossRef failed:', e.message);
    }
  }

  // Method 2: Try citation-js
  if (isUrl || doi) {
    try {
      console.log('Trying citation-js');
      const url = isUrl ? input : (doi ? `https://doi.org/${doi}` : input);
      const citation = await Cite.async(url);
      const citationData = await citation.get();
      
      if (citationData && citationData.length > 0) {
        const data = citationData[0];
        const authors = (data.author || []).map((author: any) => {
          if (author.family && author.given) {
            return `${author.family}, ${author.given}`;
          }
          return author.family || author.literal || '';
        });

        const dateParts = data.issued?.['date-parts']?.[0] || [];
        const year = dateParts[0] || '';
        const month = dateParts[1] || '';
        const day = dateParts[2] || '';
        
        let dateStr = '';
        if (year) {
          if (month && day) {
            dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          } else if (month) {
            dateStr = `${year}-${String(month).padStart(2, '0')}-01`;
          } else {
            dateStr = `${year}-01-01`;
          }
        }

        const result = {
          title: data.title || '',
          authors: authors.filter(Boolean),
          date: dateStr,
          journal: data['container-title'] || '',
          publisher: data.publisher || '',
          volume: data.volume?.toString(),
          issue: data.issue?.toString(),
          pages: data.page,
          doi: data.DOI,
          url: isUrl ? input : data.URL,
          type: data.type === 'article-journal' ? 'article' :
                data.type === 'book' ? 'book' :
                data.type === 'thesis' ? 'thesis' :
                'article',
        };

        if (result.title && result.title.trim() !== '') {
          console.log('Successfully parsed from citation-js');
          return result;
        }
      }
    } catch (e: any) {
      console.log('Citation-js failed:', e.message);
    }
  }

  // Method 3: For URLs (not DOIs), fetch the actual page content and use Claude AI to extract
  if (isUrl && !doi) {
    try {
      console.log('URL detected (not DOI), fetching webpage content for Claude extraction...');
      const parsed = await extractWithClaude(input);
      if (parsed && parsed.title && parsed.title.trim() !== '') {
        console.log('Successfully extracted using Claude from webpage');
        return parsed;
      }
    } catch (e: any) {
      console.log('Claude extraction from webpage failed:', e.message);
      // Don't throw - allow fallback to manual entry
      throw new Error(`Couldn't access this page automatically. ${e.message}. Please fill in the details manually.`);
    }
  }

  // Method 4: Try to parse citation text manually (basic parsing)
  if (!isUrl) {
    return parseCitationText(input);
  }

  // If all else fails, return minimal data from URL (don't throw error)
  // This allows the user to still save the URL and fill in details manually
  try {
    const urlObj = new URL(input);
    const domain = urlObj.hostname.replace('www.', '');
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    const suggestedTitle = pathParts.length > 0 
      ? pathParts[pathParts.length - 1].replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '')
      : domain;
    
    console.log('Returning minimal data from URL');
    return {
      title: suggestedTitle || 'Untitled',
      authors: [],
      date: new Date().toISOString().split('T')[0],
      url: input,
      type: 'website',
      journal: domain,
    };
  } catch {
    // Invalid URL format
    throw new Error('Invalid URL format. Please enter a valid URL.');
  }
}

/**
 * Fetch webpage content using CORS proxy
 * IMPORTANT: We must fetch the actual page content, not try to extract from URL string
 */
async function fetchWebpageContent(url: string): Promise<string> {
  const proxies = [
    // Method 1: AllOrigins (primary)
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    // Method 2: CORS Proxy (fallback)
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ];

  for (const proxyUrl of proxies) {
    try {
      console.log('Fetching webpage via proxy:', proxyUrl.substring(0, 50) + '...');
      const response = await fetch(proxyUrl, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      
      if (response.ok) {
        // AllOrigins returns JSON with 'contents' field
        if (proxyUrl.includes('allorigins.win')) {
          const data = await response.json();
          const html = data.contents || '';
          if (html && typeof html === 'string' && html.length > 100) {
            console.log('Successfully fetched webpage content via AllOrigins');
            return html;
          }
        } else {
          // CORS Proxy returns HTML directly
          const html = await response.text();
          if (html && html.length > 100) {
            console.log('Successfully fetched webpage content via CORS Proxy');
            return html;
          }
        }
      }
    } catch (e: any) {
      console.log('Proxy failed:', e.message);
      continue;
    }
  }

  // If all proxies fail, throw error (don't try direct fetch - it will fail due to CORS)
  throw new Error('Could not fetch webpage content. The website may block automated access or require authentication.');
}

/**
 * Extract text content from HTML (more comprehensive)
 */
function extractTextFromHTML(html: string): string {
  try {
    // Create a temporary DOM element to parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove unwanted elements
    const unwanted = doc.querySelectorAll('script, style, nav, footer, header, aside, .ad, .advertisement, .sidebar, .menu, .navigation');
    unwanted.forEach(el => el.remove());
    
    // Try to get main content area
    const mainContent = doc.querySelector('main, article, .content, .article, .post, #content, #main') 
      || doc.body 
      || doc.documentElement;
    
    // Extract text with some structure preserved
    let text = '';
    
    // Get title
    const title = doc.querySelector('title, h1, .title, .article-title');
    if (title) {
      text += `Title: ${title.textContent}\n\n`;
    }
    
    // Get meta description
    const metaDesc = doc.querySelector('meta[name="description"]');
    if (metaDesc) {
      text += `Description: ${metaDesc.getAttribute('content')}\n\n`;
    }
    
    // Get author from meta tags
    const authorMeta = doc.querySelector('meta[name="author"], meta[property="article:author"]');
    if (authorMeta) {
      text += `Author: ${authorMeta.getAttribute('content')}\n\n`;
    }
    
    // Get main content
    const content = mainContent.textContent || mainContent.innerText || '';
    text += `Content:\n${content}`;
    
    return text.trim();
  } catch (e) {
    // Fallback: just return the HTML as text
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

/**
 * Extract citation information using Claude AI via proxy
 */
async function extractWithClaude(url: string): Promise<ParsedCitation> {
  // Fetch webpage content
  let webpageContent = '';
  try {
    console.log('Fetching webpage content from:', url);
    const html = await fetchWebpageContent(url);
    console.log('Fetched HTML length:', html.length);
    
    webpageContent = extractTextFromHTML(html);
    console.log('Extracted text length:', webpageContent.length);
    
    // Limit content size (Claude has token limits, but keep more for better extraction)
    if (webpageContent.length > 100000) {
      // Keep first part (usually has title, author, abstract) and last part (conclusion)
      const firstPart = webpageContent.substring(0, 60000);
      const lastPart = webpageContent.substring(webpageContent.length - 20000);
      webpageContent = firstPart + '\n\n[... content truncated ...]\n\n' + lastPart;
    }
  } catch (e: any) {
    console.error('Could not fetch webpage:', e.message);
    throw new Error(`Couldn't access this page automatically. ${e.message}. Please fill in the details manually.`);
  }
  
  if (!webpageContent || webpageContent.length < 100) {
    throw new Error(`Couldn't access this page automatically. The page might be empty, paywalled, or require authentication. Please fill in the details manually.`);
  }

  // Use the extractInfoWithClaude function from anthropic.ts which uses the proxy
  try {
    const result = await extractInfoWithClaude(webpageContent, url);
    return result;
  } catch (error: any) {
    console.error('Claude extraction error:', error);
    throw error;
  }
}

/**
 * Basic citation text parsing (fallback)
 */
function parseCitationText(text: string): ParsedCitation {
  // Very basic parsing - extract what we can
  const lines = text.split('\n').filter(l => l.trim());
  
  // Try to extract title (usually first line or in quotes)
  const titleMatch = text.match(/"([^"]+)"/) || text.match(/'([^']+)'/);
  const title = titleMatch ? titleMatch[1] : (lines[0] || '').substring(0, 200);

  // Try to extract authors (before title, often ends with period or comma)
  const authorMatch = text.match(/^([^."]+?)(?:\.|,)\s*["']/);
  const authors = authorMatch 
    ? authorMatch[1].split(/[,&;]/).map(a => a.trim()).filter(Boolean)
    : [];

  // Try to extract year
  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : '';

  return {
    title: title.trim() || 'Untitled',
    authors: authors.length > 0 ? authors : [],
    date: year ? `${year}-01-01` : '',
    type: 'article',
  };
}
