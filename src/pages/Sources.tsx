import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSourcesStore, useActivityStore } from '../stores';
import { useToastStore } from '../stores/toastStore';
import { useSources } from '../hooks/useSources';
import { SourceCard } from '../components/sources/SourceCard';
import { SourceForm } from '../components/sources/SourceForm';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Dropdown } from '../components/ui/Dropdown';
import { SkeletonList } from '../components/ui/Skeleton';
import { Icons } from '../config/icons';
import { generateBibliography, type CitationFormat } from '../utils/citationFormatter';
import { callClaude, getUsageFromResponse } from '../utils/claudeClient';
import { incrementUsage } from '../utils/anthropic';

interface ResearchGap {
  gap: string;
  explanation: string;
}

export const Sources = () => {
  const { sources: liveSources, isLoading } = useSources();
  const { createSource, updateSource, deleteSource, setSelectedSource, selectedSource, searchSources } = useSourcesStore();
  const { addActivity } = useActivityStore();
  const { success, error } = useToastStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightSourceId = searchParams.get('highlight');
  const highlightedRef = useRef<HTMLDivElement>(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<typeof selectedSource>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSources, setFilteredSources] = useState(liveSources);
  const [citationFormat, setCitationFormat] = useState<CitationFormat>('apa');
  const [isAnalyzingGaps, setIsAnalyzingGaps] = useState(false);
  const [researchGaps, setResearchGaps] = useState<ResearchGap[] | null>(null);
  const [showGapsModal, setShowGapsModal] = useState(false);

  useEffect(() => {
    if (searchQuery.trim()) {
      searchSources(searchQuery).then((results) => {
        setFilteredSources(results as any);
      });
    } else {
      setFilteredSources(liveSources as any);
    }
  }, [searchQuery, liveSources, searchSources]);

  useEffect(() => {
    if (highlightSourceId && highlightedRef.current) {
      setTimeout(() => {
        highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        highlightedRef.current?.classList.add('ring-4', 'ring-amber-400', 'ring-opacity-75', 'transition-all', 'duration-2000');
        setTimeout(() => {
          highlightedRef.current?.classList.remove('ring-4', 'ring-amber-400', 'ring-opacity-75');
          highlightedRef.current?.classList.add('ring-0');
          navigate('/sources', { replace: true });
        }, 2000);
      }, 300);
    }
  }, [highlightSourceId, navigate, liveSources]);

  const handleCreate = () => {
    setEditingSource(null);
    setIsFormOpen(true);
  };

  const handleEdit = (source: typeof selectedSource) => {
    setEditingSource(source);
    setSelectedSource(source);
    setIsFormOpen(true);
  };

  const handleSubmit = async (sourceData: Parameters<typeof createSource>[0]) => {
    try {
      if (editingSource) {
        await updateSource(editingSource.id, sourceData);
        await addActivity({ type: 'source', itemId: editingSource.id, action: 'updated' });
        success('Source updated successfully');
      } else {
        const id = await createSource(sourceData);
        await addActivity({ type: 'source', itemId: id, action: 'created' });
        success('Source created successfully');
      }
      setIsFormOpen(false);
      setEditingSource(null);
      setSelectedSource(null);
    } catch (err) {
      error('Failed to save source');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSource(id);
      await addActivity({ type: 'source', itemId: id, action: 'updated' });
      success('Source deleted successfully');
    } catch (err) {
      error('Failed to delete source');
    }
  };

  const handleResearchGapAnalysis = async () => {
    if (liveSources.length === 0) {
      error('Add at least one source before analyzing research gaps');
      return;
    }

    setIsAnalyzingGaps(true);
    try {
      const sourcesSummary = liveSources
        .map((source) => {
          const abstract = (source as { summary?: string; notes?: string }).summary
            || (source as { notes?: string }).notes
            || 'No abstract available';
          return `Title: ${source.title}\nAbstract/Summary: ${abstract}`;
        })
        .join('\n\n');

      const response = await callClaude({
        messages: [{
          role: 'user',
          content: `Based on these academic sources, identify 3-5 research gaps or underexplored areas.

Sources:
${sourcesSummary}

Return ONLY a JSON array of objects with "gap" (title) and "explanation" fields.`,
        }],
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
      });

      const usage = getUsageFromResponse(response);
      incrementUsage(usage.inputTokens + usage.outputTokens);

      if (!response.content?.[0] || response.content[0].type !== 'text') {
        throw new Error('Unexpected response from AI');
      }

      let text = response.content[0].text.trim();
      text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Failed to parse research gaps from AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as ResearchGap[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('No research gaps returned');
      }

      setResearchGaps(parsed);
      setShowGapsModal(true);
    } catch (err: any) {
      error(err.message || 'Failed to analyze research gaps');
    } finally {
      setIsAnalyzingGaps(false);
    }
  };

  const handleCopyAllCitations = async () => {
    try {
      const bibliography = generateBibliography(filteredSources as any, citationFormat);
      await navigator.clipboard.writeText(bibliography);
      success(`Copied ${filteredSources.length} citations to clipboard!`);
    } catch (err) {
      error('Failed to copy citations');
    }
  };

  return (
    <div className="space-y-section">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <h1>Sources</h1>
          <p>Manage your research sources and citations</p>
        </div>
        <Button onClick={handleCreate}>Add Source</Button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <Card className="flex-1 p-4">
          <Input
            placeholder="Search sources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search sources"
          />
        </Card>
        <div className="w-48">
          <Dropdown
            label="Citation Style"
            options={[
              { value: 'apa', label: 'APA' },
              { value: 'mla', label: 'MLA' },
              { value: 'chicago', label: 'Chicago' },
            ]}
            value={citationFormat}
            onChange={(value) => setCitationFormat(value as CitationFormat)}
          />
        </div>
        <Button
          variant="secondary"
          onClick={handleResearchGapAnalysis}
          disabled={isAnalyzingGaps || liveSources.length === 0}
          className="whitespace-nowrap"
        >
          {isAnalyzingGaps ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              Analyzing...
            </>
          ) : (
            <>✨ Research Gap Analyzer</>
          )}
        </Button>
        {filteredSources.length > 0 && (
          <Button
            onClick={handleCopyAllCitations}
            className="whitespace-nowrap"
          >
            <Icons.copy size={14} className="inline mr-1" />
            Copy All Citations
          </Button>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <SkeletonList count={5} />
      ) : filteredSources.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">No sources yet</p>
          <p className="empty-state-subtitle">Click "Add Source" to add your first source</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSources.map((source) => (
            <div
              key={source.id}
              ref={highlightSourceId === String(source.id) ? highlightedRef : null}
              className={highlightSourceId === String(source.id) ? 'rounded-lg' : ''}
            >
              <SourceCard
                source={source as any}
                citationFormat={citationFormat}
                onSelect={handleEdit}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showGapsModal}
        onClose={() => setShowGapsModal(false)}
        title="Research Gaps"
        size="lg"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {researchGaps?.map((item, idx) => (
            <Card key={idx} className="p-4">
              <h3 className="font-semibold text-text-primary text-lg mb-2">{item.gap}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{item.explanation}</p>
            </Card>
          ))}
        </div>
      </Modal>

      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingSource(null);
          setSelectedSource(null);
        }}
        title={editingSource ? 'Edit Source' : 'New Source'}
        size="xl"
      >
        <SourceForm
          source={editingSource || undefined}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingSource(null);
            setSelectedSource(null);
          }}
        />
      </Modal>
    </div>
  );
};
