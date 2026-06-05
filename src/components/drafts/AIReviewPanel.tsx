import { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Icons } from '../../config/icons';

interface AIReviewResult {
  strengths: string[];
  improvements: string[];
  gaps: string[];
  toneAssessment: string;
}

interface AIReviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onReview: (content: string) => Promise<AIReviewResult>;
  content: string;
}

export const AIReviewPanel = ({ isOpen, onClose, onReview, content }: AIReviewPanelProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AIReviewResult | null>(null);

  const handleReview = async () => {
    setIsLoading(true);
    try {
      const reviewResult = await onReview(content);
      setResult(reviewResult);
    } catch (error) {
      console.error('AI review failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-[#EEEBE4] shadow-[0_20px_60px_rgba(0,0,0,0.08)] z-50 flex flex-col rounded-2xl">
      <div className="p-5 border-b border-[#EEEBE4] bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icons.ai size={18} className="text-[#7C68CC]" />
          <h3 className="font-semibold text-[#1A1714] text-[16px] font-playfair">AI Review</h3>
        </div>
        <button
          onClick={onClose}
          className="text-[#B5AFA8] hover:text-[#1A1714] transition-colors"
        >
          <Icons.close size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-white space-y-4">
        {!result ? (
          <div className="text-center py-8 bg-white">
            <p className="text-[#7C7469] text-sm mb-4">
              Get AI-powered feedback on your draft
            </p>
            <Button 
              onClick={handleReview} 
              disabled={isLoading || !content.trim()}
              className="bg-[#E8C96A] text-[#1A1714] font-semibold rounded-xl px-6 py-3 hover:bg-[#D9B84F]"
            >
              {isLoading ? 'Analyzing...' : 'Start Review'}
            </Button>
          </div>
        ) : (
          <>
            {/* Strengths */}
            <div className="bg-[#EFF7F3] border border-[#C8E6D4] rounded-xl p-4 mb-3">
              <h4 className="text-[#5A9E76] font-semibold text-sm uppercase tracking-wide mb-2 flex items-center gap-2">
                <Icons.success size={16} />
                Strengths
              </h4>
              <ul className="space-y-1 text-sm text-[#1A1714]">
                {result.strengths.map((strength, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#5A9E76]">•</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Improvements */}
            <div className="bg-[#FBF6E8] border border-[#F0E0A0] rounded-xl p-4 mb-3">
              <h4 className="text-[#B8920A] font-semibold text-sm uppercase tracking-wide mb-2 flex items-center gap-2">
                <Icons.info size={16} />
                Areas to Improve
              </h4>
              <ul className="space-y-1 text-sm text-[#1A1714]">
                {result.improvements.map((improvement, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#B8920A]">•</span>
                    <span>{improvement}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Evidence Gaps */}
            <div className="bg-[#FDF3F3] border border-[#EDCFCF] rounded-xl p-4 mb-3">
              <h4 className="text-[#C05454] font-semibold text-sm uppercase tracking-wide mb-2 flex items-center gap-2">
                <Icons.search size={16} />
                Argument Gaps
              </h4>
              <ul className="space-y-1 text-sm text-[#1A1714]">
                {result.gaps.map((gap, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#C05454]">•</span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tone Assessment */}
            <div className="bg-[#F7F5F0] border border-[#EEEBE4] rounded-xl p-4 mb-3">
              <h4 className="text-[#7C7469] font-semibold text-sm uppercase tracking-wide mb-2 flex items-center gap-2">
                <Icons.edit size={16} />
                Tone Assessment
              </h4>
              <p className="text-sm text-[#1A1714]">
                {result.toneAssessment}
              </p>
            </div>

            <Button variant="secondary" onClick={() => setResult(null)}>
              Review Again
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
