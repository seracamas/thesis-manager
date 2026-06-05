import { useState, useRef, useEffect } from 'react';
import { ThemeTagPopover } from './ThemeTagPopover';
import { useThemeOccurrencesStore } from '../../stores/themeOccurrencesStore';
import { useThemesStore } from '../../stores/themesStore';
import { useToastStore } from '../../stores/toastStore';

interface SelectableTextProps {
  text: string;
  interviewId: number; // Number ID from database
  interviewTitle: string;
  occurrences?: Array<{ themeId: number; startIndex: number; endIndex: number; color: string }>;
  onOccurrenceChange?: () => void;
}

export const SelectableText = ({
  text,
  interviewId,
  interviewTitle,
  occurrences = [],
  onOccurrenceChange,
}: SelectableTextProps) => {
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number; text: string } | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const { createOccurrence } = useThemeOccurrencesStore();
  const { themes } = useThemesStore();
  const { success } = useToastStore();

  // Get context around selected text
  const getContext = (start: number, end: number): string => {
    const contextBefore = text.substring(Math.max(0, start - 100), start);
    const contextAfter = text.substring(end, Math.min(text.length, end + 100));
    return `${contextBefore}[SELECTED]${contextAfter}`;
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setSelectedRange(null);
      setPopoverPosition(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();

    if (!selectedText || !textRef.current) {
      setSelectedRange(null);
      setPopoverPosition(null);
      return;
    }

    // Check if selection is within our text container
    if (!textRef.current.contains(range.commonAncestorContainer)) {
      setSelectedRange(null);
      setPopoverPosition(null);
      return;
    }

    // Calculate start/end indices by walking the DOM tree
    const textNode = textRef.current;
    const walker = document.createTreeWalker(
      textNode,
      NodeFilter.SHOW_TEXT,
      null
    );

    let charCount = 0;
    let startIndex = -1;
    let endIndex = -1;
    const rangeStart = range.startContainer;
    const rangeEnd = range.endContainer;
    const rangeStartOffset = range.startOffset;
    const rangeEndOffset = range.endOffset;

    let node;
    while (node = walker.nextNode()) {
      const nodeLength = node.textContent?.length || 0;
      
      if (node === rangeStart) {
        startIndex = charCount + rangeStartOffset;
      }
      if (node === rangeEnd) {
        endIndex = charCount + rangeEndOffset;
        break;
      }
      
      charCount += nodeLength;
    }

    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
      // Fallback: use plain text search
      const plainText = textNode.textContent || '';
      const fallbackStart = plainText.indexOf(selectedText);
      if (fallbackStart !== -1) {
        startIndex = fallbackStart;
        endIndex = fallbackStart + selectedText.length;
      } else {
        setSelectedRange(null);
        setPopoverPosition(null);
        return;
      }
    }

    const rect = range.getBoundingClientRect();

    setSelectedRange({
      start: startIndex,
      end: endIndex,
      text: selectedText,
    });
    setPopoverPosition({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  const handleTag = async (themeId: string) => {
    if (!selectedRange) return;

    // Convert themeId to number for comparison (new schema uses number IDs)
    const themeIdNum = Number(themeId);
    const theme = themes.find(t => t.id === themeIdNum);
    if (!theme) return;

    // Check if this exact range is already tagged
    const existing = occurrences.find(
      o => o.startIndex === selectedRange.start && o.endIndex === selectedRange.end && o.themeId === themeIdNum
    );

    if (existing) {
      success('This passage is already tagged with this theme');
      setSelectedRange(null);
      setPopoverPosition(null);
      return;
    }

    try {
      await createOccurrence({
        themeId: themeIdNum, // Already converted to number
        interviewId, // interviewId is already a number
        interviewTitle,
        passageText: selectedRange.text,
        passageContext: getContext(selectedRange.start, selectedRange.end),
        startIndex: selectedRange.start,
        endIndex: selectedRange.end,
      });

      success(`Tagged with theme: ${theme.name}`);
      setSelectedRange(null);
      setPopoverPosition(null);
      window.getSelection()?.removeAllRanges();
      onOccurrenceChange?.();
    } catch (error) {
      console.error('Failed to tag theme:', error);
    }
  };

  // Render text with highlights
  const renderHighlightedText = () => {
    if (occurrences.length === 0) {
      return <span>{text}</span>;
    }

    // Sort occurrences by start index
    const sorted = [...occurrences].sort((a, b) => a.startIndex - b.startIndex);
    const parts: Array<{ text: string; themeId?: number; color?: string }> = [];
    let lastIndex = 0;

    sorted.forEach((occ) => {
      if (occ.startIndex > lastIndex) {
        parts.push({ text: text.substring(lastIndex, occ.startIndex) });
      }
      parts.push({
        text: text.substring(occ.startIndex, occ.endIndex),
        themeId: occ.themeId,
        color: occ.color,
      });
      lastIndex = occ.endIndex;
    });

    if (lastIndex < text.length) {
      parts.push({ text: text.substring(lastIndex) });
    }

    return (
      <>
        {parts.map((part, idx) => {
          if (part.themeId && part.color) {
            return (
              <mark
                key={idx}
                style={{
                  backgroundColor: `${part.color}40`,
                  borderBottom: `2px solid ${part.color}`,
                  padding: '2px 0',
                }}
                title={themes.find(t => t.id === part.themeId)?.name || ''}
              >
                {part.text}
              </mark>
            );
          }
          return <span key={idx}>{part.text}</span>;
        })}
      </>
    );
  };

  useEffect(() => {
    document.addEventListener('selectionchange', handleTextSelection);
    return () => document.removeEventListener('selectionchange', handleTextSelection);
  }, [text, occurrences]);

  return (
    <>
      <div
        ref={textRef}
        className="select-text"
        onMouseUp={handleTextSelection}
        style={{ userSelect: 'text' }}
      >
        {renderHighlightedText()}
      </div>

      {selectedRange && popoverPosition && (
        <ThemeTagPopover
          selectedText={selectedRange.text}
          context={getContext(selectedRange.start, selectedRange.end)}
          startIndex={selectedRange.start}
          endIndex={selectedRange.end}
          interviewId={interviewId}
          interviewTitle={interviewTitle}
          onTag={handleTag}
          onClose={() => {
            setSelectedRange(null);
            setPopoverPosition(null);
            window.getSelection()?.removeAllRanges();
          }}
          position={popoverPosition}
        />
      )}
    </>
  );
};
