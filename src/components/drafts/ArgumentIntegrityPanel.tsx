import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Icons } from '../../config/icons';

export interface ArgumentIntegrityResult {
  unsupportedClaims: Array<{ claim: string; suggestion: string }>;
  logicGaps: Array<{ description: string; location: string }>;
  strengthScore: number;
  strengthRationale: string;
  topSuggestion: string;
}

interface ArgumentIntegrityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (content: string) => Promise<ArgumentIntegrityResult>;
  content: string;
}

function scoreBadgeClass(score: number): string {
  if (score < 5) return 'bg-[#FDF3F3] text-[#C05454] border-[#EDCFCF]';
  if (score < 8) return 'bg-[#FBF6E8] text-[#B8920A] border-[#F0E0A0]';
  return 'bg-[#EFF7F3] text-[#5A9E76] border-[#C8E6D4]';
}

export const ArgumentIntegrityPanel = ({
  isOpen,
  onClose,
  onAnalyze,
  content,
}: ArgumentIntegrityPanelProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ArgumentIntegrityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    if (!content.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const analysis = await onAnalyze(content);
      setResult(analysis);
    } catch (err: any) {
      setError(err.message || 'Argument check failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setResult(null);
      setError(null);
      runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-[#EEEBE4] shadow-[0_20px_60px_rgba(0,0,0,0.08)] z-50 flex flex-col">
      <div className="p-5 border-b border-[#EEEBE4] bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">🔍</span>
          <h3 className="font-semibold text-[#1A1714] text-[16px] font-playfair">Argument Integrity</h3>
        </div>
        <button
          onClick={onClose}
          className="text-[#B5AFA8] hover:text-[#1A1714] transition-colors"
          aria-label="Close panel"
        >
          <Icons.close size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-white space-y-4">
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-2 border-[#7C68CC] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[#7C7469] text-sm">Analyzing argument structure...</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="bg-[#FDF3F3] border border-[#EDCFCF] rounded-xl p-4 text-sm text-[#C05454]">
            {error}
            <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={runAnalysis}>
              Try Again
            </Button>
          </div>
        )}

        {result && !isLoading && (
          <>
            <div className={`rounded-xl border p-4 text-center ${scoreBadgeClass(result.strengthScore)}`}>
              <p className="text-xs uppercase tracking-wide font-semibold mb-1">Strength Score</p>
              <p className="text-4xl font-bold">{result.strengthScore}/10</p>
              <p className="text-sm mt-2">{result.strengthRationale}</p>
            </div>

            <div className="bg-[#EEF4FC] border border-[#C5D9F0] rounded-xl p-4">
              <h4 className="text-[#3B6FA8] font-semibold text-sm uppercase tracking-wide mb-2">
                Top Suggestion
              </h4>
              <p className="text-sm text-[#1A1714]">{result.topSuggestion}</p>
            </div>

            {result.unsupportedClaims.length > 0 && (
              <div>
                <h4 className="text-[#C05454] font-semibold text-sm uppercase tracking-wide mb-2">
                  Unsupported Claims
                </h4>
                <div className="space-y-2">
                  {result.unsupportedClaims.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-[#FDF3F3] border border-[#EDCFCF] rounded-xl p-3 text-sm"
                    >
                      <p className="font-medium text-[#1A1714]">{item.claim}</p>
                      <p className="text-[#7C7469] mt-1">{item.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.logicGaps.length > 0 && (
              <div>
                <h4 className="text-[#B8920A] font-semibold text-sm uppercase tracking-wide mb-2">
                  Logic Gaps
                </h4>
                <div className="space-y-2">
                  {result.logicGaps.map((gap, idx) => (
                    <div
                      key={idx}
                      className="bg-[#FBF6E8] border border-[#F0E0A0] rounded-xl p-3 text-sm"
                    >
                      <p className="text-[#1A1714]">{gap.description}</p>
                      {gap.location && (
                        <p className="text-[#7C7469] text-xs mt-1">Location: {gap.location}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button variant="secondary" onClick={runAnalysis} disabled={isLoading}>
              Check Again
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
