import { db } from './db';
import type { Theme, ThemeOccurrence } from '../types';
import jsPDF from 'jspdf';

/**
 * Export themes to PDF
 */
export async function exportThemesToPDF(themeId?: string): Promise<void> {
  const themes = themeId 
    ? [await db.themes.get(Number(themeId))].filter(Boolean) as Theme[]
    : await db.themes.toArray();
  
  const doc = new jsPDF();
  let yPos = 20;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const lineHeight = 7;

  for (const [themeIndex, theme] of themes.entries()) {
    // Add new page if needed (except for first theme)
    if (themeIndex > 0 && yPos > pageHeight - 40) {
      doc.addPage();
      yPos = 20;
    }

    // Theme header
    doc.setFontSize(16);
    doc.setTextColor(parseInt(theme.color.slice(1, 3), 16), parseInt(theme.color.slice(3, 5), 16), parseInt(theme.color.slice(5, 7), 16));
    doc.text(theme.name, margin, yPos);
    yPos += lineHeight * 2;

    // Description
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    const descriptionLines = doc.splitTextToSize(theme.description || '', 170);
    doc.text(descriptionLines, margin, yPos);
    yPos += descriptionLines.length * lineHeight + 5;

    // Get occurrences
    const occurrences = await db.themeOccurrences.where('themeId').equals(theme.id!).toArray();
    const occurrencesByInterview = occurrences.reduce((acc, occ) => {
      if (!acc[occ.interviewId]) acc[occ.interviewId] = [];
      acc[occ.interviewId].push(occ);
      return acc;
    }, {} as Record<string, ThemeOccurrence[]>);

    // Group by interview
    for (const [interviewId, occs] of Object.entries(occurrencesByInterview)) {
      const interview = await db.interviews.get(Number(interviewId));
      
      // Check if we need a new page
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = 20;
      }

      // Interview header
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`Interview: ${interview?.interviewee || occs[0]?.interviewTitle || 'Unknown'}`, margin, yPos);
      yPos += lineHeight * 1.5;

      // Passages
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      for (const occ of occs) {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = 20;
        }

        const passageLines = doc.splitTextToSize(`"${occ.passageText}"`, 170);
        doc.text(passageLines, margin + 5, yPos);
        yPos += passageLines.length * lineHeight + 3;

        if (occ.note) {
          const noteLines = doc.splitTextToSize(`Note: ${occ.note}`, 165);
          doc.text(noteLines, margin + 10, yPos);
          yPos += noteLines.length * lineHeight + 2;
        }
        yPos += 3;
      }
      yPos += 5;
    }

    yPos += 10;
  }

  // Save PDF
  const filename = themeId 
    ? `theme-${themes[0]?.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`
    : `themes-export-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

/**
 * Export themes to DOCX
 */
export async function exportThemesToDOCX(themeId?: string): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
  
  const themes = themeId 
    ? [await db.themes.get(Number(themeId))].filter(Boolean) as Theme[]
    : await db.themes.toArray();

  const children: Paragraph[] = [];

  for (const theme of themes) {
    // Theme title
    children.push(
      new Paragraph({
        text: theme.name,
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      })
    );

    // Description
    if (theme.description) {
      children.push(
        new Paragraph({
          text: theme.description,
          spacing: { after: 200 },
        })
      );
    }

    // Get occurrences
    const occurrences = await db.themeOccurrences.where('themeId').equals(theme.id!).toArray();
    const occurrencesByInterview = occurrences.reduce((acc, occ) => {
      if (!acc[occ.interviewId]) acc[occ.interviewId] = [];
      acc[occ.interviewId].push(occ);
      return acc;
    }, {} as Record<string, ThemeOccurrence[]>);

    // Group by interview
    for (const [interviewId, occs] of Object.entries(occurrencesByInterview)) {
      const interview = await db.interviews.get(Number(interviewId));
      
      // Interview header
      children.push(
        new Paragraph({
          text: `Interview: ${interview?.interviewee || occs[0]?.interviewTitle || 'Unknown'}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 },
        })
      );

      // Passages
      for (const occ of occs) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `"${occ.passageText}"`,
                italics: true,
              }),
            ],
            spacing: { after: 100 },
          })
        );

        if (occ.note) {
          children.push(
            new Paragraph({
              text: `Note: ${occ.note}`,
              spacing: { after: 200 },
            })
          );
        }
      }
    }

    children.push(
      new Paragraph({
        text: '',
        spacing: { after: 400 },
      })
    );
  }

  const doc = new Document({
    sections: [{
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = themeId 
    ? `theme-${themes[0]?.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.docx`
    : `themes-export-${new Date().toISOString().split('T')[0]}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
