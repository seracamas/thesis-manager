import { useState, useEffect } from 'react';
import { Source } from '../../types';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import { Tag } from '../ui/Tag';
import { RichTextEditor } from '../editor/RichTextEditor';
import { ThemeSuggestions } from '../ai/ThemeSuggestions';
import { generateCitation, generateCitationFromData, getCitationStyles, type CitationStyle, type CitationType } from '../../utils/citations';
import { parseCitation, type ParsedCitation } from '../../utils/citationParser';
import { useToastStore } from '../../stores/toastStore';

interface SourceFormProps {
  source?: Source;
  onSubmit: (source: Omit<Source, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
}

export const SourceForm = ({ source, onSubmit, onCancel }: SourceFormProps) => {
  const [title, setTitle] = useState(source?.title || '');
  const [authors, setAuthors] = useState(source?.authors.join(', ') || '');
  const [date, setDate] = useState(source?.date || '');
  const [type, setType] = useState<Source['type']>(source?.type || 'article');
  const [citation, setCitation] = useState(source?.citation || '');
  const [url, setUrl] = useState(source?.url || '');
  const [notes, setNotes] = useState(source?.notes || '');
  const [tags, setTags] = useState<string[]>(source?.tags || []);
  const [newTag, setNewTag] = useState('');
  const [journal, setJournal] = useState(source?.journal || '');
  const [publisher, setPublisher] = useState(source?.publisher || '');
  const [volume, setVolume] = useState(source?.volume || '');
  const [issue, setIssue] = useState(source?.issue || '');
  const [pages, setPages] = useState(source?.pages || '');
  const [doi, setDoi] = useState(source?.doi || '');
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('apa');
  const [citationType, setCitationType] = useState<CitationType>('full');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedCitation | null>(null);
  const { success, error: showError } = useToastStore();

  // Initialize form fields when source changes
  useEffect(() => {
    if (source) {
      setTitle(source.title);
      setAuthors(source.authors.join(', '));
      setDate(source.date);
      setType(source.type);
      setCitation(source.citation);
      setUrl(source.url || '');
      setNotes(source.notes || '');
      setTags(source.tags);
      setJournal(source.journal || '');
      setPublisher(source.publisher || '');
      setVolume(source.volume || '');
      setIssue(source.issue || '');
      setPages(source.pages || '');
      setDoi(source.doi || '');
    }
  }, [source]);

  // Regenerate citation when style or type changes
  useEffect(() => {
    if (parsedData) {
      const generatedCitation = generateCitation(parsedData, citationStyle, citationType);
      setCitation(generatedCitation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citationStyle, citationType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generate AI summary if we have parsed data or content
    let aiSummary = source?.summary || '';
    if (parsedData?.abstract) {
      aiSummary = parsedData.abstract;
    } else if ((title || notes || url) && !source) {
      // Generate summary for new sources using Claude
      try {
        const { summarizeContent } = await import('../../utils/anthropic');
        const contentToSummarize = parsedData?.abstract 
          ? parsedData.abstract 
          : `${title}\n\n${notes || ''}\n\n${url ? `URL: ${url}` : ''}`;
        
        if (contentToSummarize.trim().length > 50) {
          const summaryResult = await summarizeContent(contentToSummarize, 'source');
          aiSummary = summaryResult.summary;
          success('AI summary generated!');
        }
      } catch (err: any) {
        console.log('Could not generate summary:', err);
        // Don't show error, just continue without summary
      }
    }
    
    await onSubmit({
      title,
      authors: authors.split(',').map((a) => a.trim()).filter(Boolean),
      date,
      type,
      citation,
      url: url || undefined,
      notes: notes || undefined,
      tags,
      summary: aiSummary || source?.summary || undefined,
      journal: journal || parsedData?.journal || undefined,
      publisher: publisher || parsedData?.publisher || undefined,
      volume: volume || parsedData?.volume || undefined,
      issue: issue || parsedData?.issue || undefined,
      pages: pages || parsedData?.pages || undefined,
      doi: doi || parsedData?.doi || undefined,
    });
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleParseCitation = async (input: string) => {
    if (!input.trim()) {
      showError('Please enter a URL');
      return;
    }

    setIsParsing(true);
    setParsedData(null); // Clear previous data
    
    try {
      console.log('Parsing citation from:', input);
      
      // Check if it's a DOI
      const doiMatch = input.match(/10\.\d{4,}\/[-._;()\/:a-zA-Z0-9]+/);
      const isDoi = doiMatch || input.includes('doi.org/');
      
      if (isDoi) {
        // For DOIs, show "Fetching metadata from DOI..."
        // (This will use CrossRef API directly, no page scraping)
      } else {
        // For URLs, show "Reading page content..."
        // (This will fetch the page and extract with Claude)
      }
      
      const parsed = await parseCitation(input);
      console.log('Parsed data:', parsed);
      
      // Even if title is empty, we can still use the parsed data
      // (it might just be a website URL without structured metadata)
      if (!parsed) {
        throw new Error('Could not process this URL. Please try again or enter the information manually.');
      }
      
      setParsedData(parsed);
      
      // Auto-fill form fields
      if (parsed.title) setTitle(parsed.title);
      if (parsed.authors.length > 0) setAuthors(parsed.authors.join(', '));
      if (parsed.date) setDate(parsed.date);
      if (parsed.type) setType(parsed.type);
      if (parsed.url && !url) setUrl(parsed.url);
      if (parsed.journal) setJournal(parsed.journal);
      if (parsed.publisher) setPublisher(parsed.publisher);
      if (parsed.volume) setVolume(parsed.volume);
      if (parsed.issue) setIssue(parsed.issue);
      if (parsed.pages) setPages(parsed.pages);
      if (parsed.doi) setDoi(parsed.doi);
      
      // Generate citation with current style/type
      try {
        const generatedCitation = generateCitation(parsed, citationStyle, citationType);
        setCitation(generatedCitation);
      } catch (citationErr: any) {
        console.error('Citation generation error:', citationErr);
        // Still show success even if citation generation fails
      }
      
      success('Information extracted successfully!');
    } catch (err: any) {
      console.error('Citation parsing error:', err);
      const errorMsg = err.message || 'Failed to extract information from URL. Please enter the details manually.';
      showError(errorMsg);
      
      // If it's a URL but parsing failed, suggest manual entry
      try {
        new URL(input);
        showError(`${errorMsg} You can still fill in the form fields manually.`);
      } catch {
        showError(errorMsg);
      }
    } finally {
      setIsParsing(false);
    }
  };

  const handleGenerateFromParsed = () => {
    if (parsedData) {
      const generatedCitation = generateCitation(parsedData, citationStyle, citationType);
      setCitation(generatedCitation);
      success('Citation regenerated!');
    } else {
      // Fallback to form data
      handleGenerateCitationFromData();
    }
  };

  const handleGenerateCitationFromData = () => {
    // Use parsed data if available, otherwise use form fields
    if (parsedData) {
      handleGenerateFromParsed();
    } else if (!title.trim()) {
      showError('Please enter a title first, or paste a citation/URL to parse');
      return;
    } else {
      try {
        const generatedCitation = generateCitationFromData(
          {
            title,
            authors: authors.split(',').map((a) => a.trim()).filter(Boolean),
            date,
            type,
            url: url || undefined,
          },
          citationStyle,
          citationType
        );
        setCitation(generatedCitation);
        success('Citation generated successfully!');
      } catch (err: any) {
        showError(err.message || 'Failed to generate citation');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-primary text-text-primary mb-2">
          Article URL *
        </label>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              value={url}
              onChange={(e) => {
                const newUrl = e.target.value;
                setUrl(newUrl);
                // Clear parsed data when URL changes
                if (newUrl !== url) {
                  setParsedData(null);
                }
              }}
              onBlur={(e) => {
                // Auto-parse when user leaves the field
                if (e.target.value.trim() && !parsedData) {
                  handleParseCitation(e.target.value);
                }
              }}
              placeholder="Paste the article URL here (e.g., DOI link, PubMed, journal article URL)..."
              required
            />
            {isParsing && (
              <p className="text-xs text-primary-600 text-accent-gold mt-1">
                {url.includes('doi.org/') || url.match(/10\.\d{4,}\//) 
                  ? '📚 Fetching metadata from DOI...' 
                  : '📄 Reading page content...'}
              </p>
            )}
            {parsedData && !isParsing && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-800 font-medium">
                  ✓ Successfully extracted: {parsedData.title || 'Untitled'} 
                  {parsedData.authors.length > 0 && ` by ${parsedData.authors[0]}`}
                  {parsedData.date && ` (${parsedData.date.split('-')[0]})`}
                  {parsedData.abstract && ' • Summary available'}
                </p>
              </div>
            )}
          </div>
          {url.trim() && (
            <Button
              type="button"
              variant="outline"
              onClick={() => handleParseCitation(url)}
              disabled={isParsing}
              className="mb-0"
            >
              {isParsing ? 'Extracting...' : 'Re-extract'}
            </Button>
          )}
        </div>
        <p className="text-xs text-text-muted text-text-secondary mt-1">
          The system will automatically extract the title, authors, date, and citation information from the URL.
        </p>
      </div>

      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        placeholder="Will be auto-filled from URL"
      />

      <Input
        label="Authors (comma-separated)"
        value={authors}
        onChange={(e) => setAuthors(e.target.value)}
        placeholder="Will be auto-filled from URL"
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <Dropdown
          label="Type"
          options={[
            { label: 'Article', value: 'article' },
            { label: 'Book', value: 'book' },
            { label: 'Website', value: 'website' },
            { label: 'Thesis', value: 'thesis' },
            { label: 'Conference', value: 'conference' },
            { label: 'Other', value: 'other' },
          ]}
          value={type}
          onChange={(value) => setType(value as Source['type'])}
        />
      </div>


      <div>
        <div className="flex items-end gap-2 mb-2">
          <div className="flex-1">
            <Input
              label="Citation"
              value={citation}
              onChange={(e) => setCitation(e.target.value)}
              placeholder={citationType === 'in-text' ? 'In-text citation (e.g., Smith, 2024)' : 'Full citation for references'}
            />
          </div>
          <div className="w-40">
            <Dropdown
              label="Type"
              options={[
                { value: 'full', label: 'Full Citation' },
                { value: 'in-text', label: 'In-Text Citation' },
              ]}
              value={citationType}
              onChange={(value) => setCitationType(value as CitationType)}
            />
          </div>
          <div className="w-48">
            <Dropdown
              label="Style"
              options={getCitationStyles()}
              value={citationStyle}
              onChange={(value) => setCitationStyle(value as CitationStyle)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleGenerateFromParsed}
            disabled={!parsedData && !title.trim()}
            className="mb-0"
          >
            Generate
          </Button>
        </div>
        <p className="text-xs text-text-muted text-text-secondary mt-1">
          <strong>Full Citation:</strong> Complete reference for bibliography/references section. 
          <strong className="ml-4">In-Text Citation:</strong> Short citation for use within your text (e.g., Smith, 2024).
        </p>
      </div>

      {parsedData && (
        <div className="p-4 bg-bg-secondary bg-white rounded-lg space-y-3">
          <h4 className="text-sm font-semibold text-text-primary text-text-primary">Extracted Information:</h4>
          
          {parsedData.abstract && (
            <div>
              <p className="text-xs font-medium text-text-primary text-text-primary mb-1">Abstract/Summary:</p>
              <p className="text-xs text-text-secondary text-text-secondary line-clamp-4">{parsedData.abstract}</p>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            {parsedData.journal && (
              <div>
                <span className="font-medium text-text-primary text-text-primary">Journal:</span>
                <span className="ml-1 text-text-secondary text-text-secondary">{parsedData.journal}</span>
              </div>
            )}
            {parsedData.publisher && (
              <div>
                <span className="font-medium text-text-primary text-text-primary">Publisher:</span>
                <span className="ml-1 text-text-secondary text-text-secondary">{parsedData.publisher}</span>
              </div>
            )}
            {parsedData.volume && (
              <div>
                <span className="font-medium text-text-primary text-text-primary">Volume:</span>
                <span className="ml-1 text-text-secondary text-text-secondary">{parsedData.volume}</span>
              </div>
            )}
            {parsedData.issue && (
              <div>
                <span className="font-medium text-text-primary text-text-primary">Issue:</span>
                <span className="ml-1 text-text-secondary text-text-secondary">{parsedData.issue}</span>
              </div>
            )}
            {parsedData.pages && (
              <div>
                <span className="font-medium text-text-primary text-text-primary">Pages:</span>
                <span className="ml-1 text-text-secondary text-text-secondary">{parsedData.pages}</span>
              </div>
            )}
            {parsedData.doi && (
              <div>
                <span className="font-medium text-text-primary text-text-primary">DOI:</span>
                <span className="ml-1 text-text-secondary text-text-secondary">{parsedData.doi}</span>
              </div>
            )}
          </div>
          
          {parsedData.keywords && parsedData.keywords.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-primary text-text-primary mb-1">Keywords:</p>
              <div className="flex flex-wrap gap-1">
                {parsedData.keywords.slice(0, 8).map((keyword, idx) => (
                  <span key={idx} className="text-xs px-2 py-1 bg-primary-100 bg-accent-gold-soft text-primary-800 text-accent-gold-dim rounded">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-text-primary text-text-primary mb-2">
          Notes
        </label>
        <RichTextEditor content={notes} onChange={setNotes} placeholder="Add notes about this source..." />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary text-text-primary mb-2">
          Tags
        </label>
        <div className="flex gap-2 mb-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Add tag"
            className="flex-1"
          />
          <Button type="button" onClick={addTag}>
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag) => (
            <Tag key={tag} onRemove={() => removeTag(tag)}>
              {tag}
            </Tag>
          ))}
        </div>
        <ThemeSuggestions
          content={`${title}\n\n${citation}\n\n${notes || ''}`}
          onAccept={(newThemes) => {
            newThemes.forEach((theme) => {
              if (!tags.includes(theme)) {
                setTags([...tags, theme]);
              }
            });
          }}
          existingTags={tags}
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save Source</Button>
      </div>
    </form>
  );
};
