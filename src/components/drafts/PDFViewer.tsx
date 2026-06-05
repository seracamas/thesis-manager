import { useEffect, useRef, useState } from 'react';

// Lazy load PDF.js
let pdfjsLib: any = null;
async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  try {
    const module = await import('pdfjs-dist');
    pdfjsLib = module;
    if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
      // Use local worker from installed package to match version automatically
      pdfjsLib.GlobalWorkerOptions.workerSrc = 
        new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
    }
    return pdfjsLib;
  } catch (error) {
    console.warn('pdfjs-dist not available');
    return null;
  }
}

interface PDFViewerProps {
  pdfData: ArrayBuffer;
  comments: Array<{
    id?: number;
    selectedText: string;
    pageNumber?: number;
    positionY: number;
    commentType: 'user' | 'ai' | 'citation';
    resolved: boolean;
  }>;
  onTextSelect?: (text: string, pageNumber: number, positionY: number) => void;
  highlightedCommentId?: number;
}

export const PDFViewer = ({ pdfData, comments, onTextSelect, highlightedCommentId }: PDFViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Array<{ canvas: HTMLCanvasElement; pageNumber: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const selectionRef = useRef<{ text: string; pageNumber: number; y: number } | null>(null);

  useEffect(() => {
    const loadPDF = async () => {
      try {
        setIsLoading(true);
        const pdfLib = await loadPdfJs();
        if (!pdfLib) {
          setIsLoading(false);
          return;
        }
        const pdf = await pdfLib.getDocument({ data: pdfData }).promise;
        const numPages = pdf.numPages;
        const pagePromises = [];

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) continue;

          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          pagePromises.push({ canvas, pageNumber: pageNum });
        }

        setPages(pagePromises);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading PDF:', error);
        setIsLoading(false);
      }
    };

    if (pdfData) {
      loadPDF();
    }
  }, [pdfData]);

  const handleMouseUp = (e: React.MouseEvent, pageNumber: number) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    
    if (containerRect && onTextSelect) {
      const positionY = rect.top - containerRect.top + containerRef.current?.scrollTop || 0;
      selectionRef.current = { text: selectedText, pageNumber, y: positionY };
      onTextSelect(selectedText, pageNumber, positionY);
    }
  };

  const getCommentColor = (commentType: 'user' | 'ai' | 'citation', resolved: boolean) => {
    if (resolved) return 'rgba(34, 197, 94, 0.3)'; // green
    if (commentType === 'ai') return 'rgba(139, 92, 246, 0.3)'; // purple
    if (commentType === 'citation') return 'rgba(59, 130, 246, 0.3)'; // blue
    return 'rgba(234, 179, 8, 0.3)'; // yellow
  };

  return (
    <div ref={containerRef} className="w-full h-full overflow-y-auto bg-bg-secondary">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-text-muted">Loading PDF...</p>
        </div>
      ) : (
        <div className="space-y-4 p-4">
          {pages.map(({ canvas, pageNumber }) => {
            const pageComments = comments.filter(c => c.pageNumber === pageNumber);
            return (
              <div
                key={pageNumber}
                className="relative bg-white shadow-lg mx-auto"
                style={{ width: canvas.width, maxWidth: '100%' }}
                onMouseUp={(e) => handleMouseUp(e, pageNumber)}
              >
                <canvas
                  ref={(node) => {
                    if (node) {
                      const ctx = node.getContext('2d');
                      if (ctx) {
                        node.width = canvas.width;
                        node.height = canvas.height;
                        ctx.drawImage(canvas, 0, 0);
                        
                        // Draw comment highlights
                        pageComments.forEach(comment => {
                          if (comment.resolved && highlightedCommentId !== comment.id) return;
                          const color = getCommentColor(comment.commentType, comment.resolved);
                          ctx.fillStyle = color;
                          // Simple highlight - in a real implementation, you'd track exact text positions
                          ctx.fillRect(0, comment.positionY % canvas.height, canvas.width, 20);
                        });
                      }
                    }
                  }}
                  className="w-full h-auto"
                />
                <div className="absolute top-2 right-2 text-xs text-text-muted bg-white px-2 py-1 rounded">
                  Page {pageNumber}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
