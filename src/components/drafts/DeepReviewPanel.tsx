import { useState } from 'react';
import clsx from 'clsx';
import { Button } from '../ui/Button';
import { Icons } from '../../config/icons';
import {
  type DeepReviewResults,
  type DeepReviewTab,
  type DeepReviewComment,
  DIMENSION_LABELS,
  isPositiveCategory,
  buildExportReport,
  downloadTextReport,
} from '../../utils/deepReview';

interface DeepReviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  results: DeepReviewResults | null;
  isLoading: boolean;
  progress: number;
  draftTitle: string;
}

function scoreColorClass(score: number): string {
  if (score < 5) return 'text-[#C05454] border-[#EDCFCF] bg-[#FDF3F3]';
  if (score < 8) return 'text-[#B8920A] border-[#F0E0A0] bg-[#FBF6E8]';
  return 'text-[#5A9E76] border-[#C8E6D4] bg-[#EFF7F3]';
}

function categoryBadgeClass(category: string): string {
  if (isPositiveCategory(category)) {
    return 'bg-[#EFF7F3] text-[#5A9E76] border-[#C8E6D4]';
  }
  if (category.includes('weak') || category.includes('issue') || category.includes('gap') || category.includes('misuse')) {
    return 'bg-[#FBF6E8] text-[#B8920A] border-[#F0E0A0]';
  }
  return 'bg-[#FDF3F3] text-[#C05454] border-[#EDCFCF]';
}

function cardBorderClass(category: string): string {
  if (isPositiveCategory(category)) {
    return 'border-[#C8E6D4] bg-[#FAFDFB]';
  }
  if (category.includes('weak') || category.includes('issue') || category.includes('gap') || category.includes('misuse')) {
    return 'border-[#F0E0A0] bg-[#FFFCF5]';
  }
  return 'border-[#EDCFCF] bg-[#FFFBFB]';
}

function formatCategoryLabel(category: string): string {
  return category.replace(/_/g, ' ');
}

function CommentCard({ item }: { item: DeepReviewComment }) {
  return (
    <div className={clsx('rounded-xl border p-4', cardBorderClass(item.category))}>
      <blockquote className="text-sm italic text-[#7C7469] bg-[#F7F5F0] rounded-lg px-3 py-2 mb-3 border-l-2 border-[#D4CFC6]">
        &ldquo;{item.quote}&rdquo;
      </blockquote>
      <span className={clsx('inline-block text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border mb-2', categoryBadgeClass(item.category))}>
        {formatCategoryLabel(item.category)}
      </span>
      <p className="text-sm text-[#1A1714] mb-3">{item.comment}</p>
      <div className="bg-[#EEF4FC] border border-[#C5D9F0] rounded-lg px-3 py-2 text-sm text-[#1A1714]">
        <span className="font-semibold text-[#3B6FA8]">Suggestion: </span>
        {item.suggestion}
      </div>
    </div>
  );
}

export const DeepReviewPanel = ({
  isOpen,
  onClose,
  results,
  isLoading,
  progress,
  draftTitle,
}: DeepReviewPanelProps) => {
  const [activeTab, setActiveTab] = useState<DeepReviewTab>('argument');

  if (!isOpen) return null;

  const handleExport = () => {
    if (!results) return;
    const report = buildExportReport(results, draftTitle);
    const safeName = draftTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'draft';
    downloadTextReport(report, `${safeName}-deep-review.txt`);
  };

  const tabComments = results ? results[activeTab].comments : [];

  return (
    <div className="fixed right-0 top-0 h-full w-full md:w-[700px] bg-white border-l border-[#EEEBE4] shadow-[0_20px_60px_rgba(0,0,0,0.08)] z-50 flex flex-col">
      <div className="p-5 border-b border-[#EEEBE4] bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[18px]">🔬</span>
          <h3 className="font-semibold text-[#1A1714] text-[16px] font-playfair">Deep Review</h3>
        </div>
        <div className="flex items-center gap-2">
          {results && !isLoading && (
            <Button variant="secondary" size="sm" onClick={handleExport}>
              📥 Export Feedback
            </Button>
          )}
          <button
            onClick={onClose}
            className="text-[#B5AFA8] hover:text-[#1A1714] transition-colors p-1"
            aria-label="Close panel"
          >
            <Icons.close size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-white">
        {isLoading && (
          <div className="py-12 text-center">
            <div className="inline-block w-10 h-10 border-2 border-[#7C68CC] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[#1A1714] font-medium mb-1">Running deep review across 5 dimensions...</p>
            <p className="text-sm text-[#7C7469] mb-4">Argument · Evidence · Structure · Style · Overall</p>
            <div className="max-w-md mx-auto h-2 bg-[#F7F5F0] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#7C68CC] transition-all duration-300 ease-out rounded-full"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <p className="text-xs text-[#B5AFA8] mt-2">{Math.round(progress)}%</p>
          </div>
        )}

        {!isLoading && results && (
          <div className="space-y-6">
            {results.failedDimensions.length > 0 && (
              <div className="bg-[#FBF6E8] border border-[#F0E0A0] rounded-xl p-3 text-sm text-[#B8920A]">
                Some dimensions could not be analyzed: {results.failedDimensions.join(', ')}. Results below include available feedback.
              </div>
            )}

            <section className="text-center">
              <div
                className={clsx(
                  'inline-flex items-center justify-center w-24 h-24 rounded-full border-4 text-3xl font-bold mb-4',
                  scoreColorClass(results.overall.overallScore ?? 0)
                )}
              >
                {results.overall.overallScore ?? '—'}
              </div>
              <p className="text-sm text-[#1A1714] leading-relaxed max-w-lg mx-auto">
                {results.overall.summary || results.overall.error || 'Overall assessment unavailable.'}
              </p>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-[#EFF7F3] border border-[#C8E6D4] rounded-xl p-4">
                <h4 className="text-[#5A9E76] font-semibold text-xs uppercase tracking-wide mb-2">Strengths</h4>
                <ul className="space-y-1 text-sm text-[#1A1714]">
                  {(results.overall.topStrengths?.length ? results.overall.topStrengths : ['—']).map((item, idx) => (
                    <li key={idx}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-[#FDF3F3] border border-[#EDCFCF] rounded-xl p-4">
                <h4 className="text-[#C05454] font-semibold text-xs uppercase tracking-wide mb-2">Weaknesses</h4>
                <ul className="space-y-1 text-sm text-[#1A1714]">
                  {(results.overall.topWeaknesses?.length ? results.overall.topWeaknesses : ['—']).map((item, idx) => (
                    <li key={idx}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-[#FBF6E8] border border-[#F0E0A0] rounded-xl p-4">
                <h4 className="text-[#B8920A] font-semibold text-xs uppercase tracking-wide mb-2">Priority Fixes</h4>
                <ul className="space-y-1 text-sm text-[#1A1714]">
                  {(results.overall.priorityRevisions?.length ? results.overall.priorityRevisions : ['—']).map((item, idx) => (
                    <li key={idx}>• {item}</li>
                  ))}
                </ul>
              </div>
            </section>

            <section>
              <div className="flex flex-wrap gap-2 border-b border-[#EEEBE4] pb-2 mb-4">
                {(Object.keys(DIMENSION_LABELS) as DeepReviewTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={clsx(
                      'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
                      activeTab === tab
                        ? 'text-[#7C68CC] border-b-2 border-[#7C68CC] bg-[#F5F1FF]'
                        : 'text-[#7C7469] hover:text-[#1A1714]'
                    )}
                  >
                    {DIMENSION_LABELS[tab]}
                    {results[tab].error && (
                      <span className="ml-1 text-[#C05454]">!</span>
                    )}
                  </button>
                ))}
              </div>

              {results[activeTab].error ? (
                <div className="bg-[#FDF3F3] border border-[#EDCFCF] rounded-xl p-4 text-sm text-[#C05454]">
                  {results[activeTab].error}
                </div>
              ) : tabComments.length === 0 ? (
                <p className="text-sm text-[#7C7469] text-center py-8">No inline comments for this dimension.</p>
              ) : (
                <div className="space-y-3">
                  {tabComments.map((item, idx) => (
                    <CommentCard key={`${activeTab}-${idx}`} item={item} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
