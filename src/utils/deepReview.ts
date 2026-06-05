export interface DeepReviewComment {
  quote: string;
  category: string;
  comment: string;
  suggestion: string;
}

export interface DimensionCommentsResult {
  comments: DeepReviewComment[];
  error?: string;
}

export interface DeepReviewOverall {
  overallScore: number;
  summary: string;
  topStrengths: string[];
  topWeaknesses: string[];
  priorityRevisions: string[];
  error?: string;
}

export interface DeepReviewResults {
  argument: DimensionCommentsResult;
  evidence: DimensionCommentsResult;
  structure: DimensionCommentsResult;
  style: DimensionCommentsResult;
  overall: DeepReviewOverall;
  failedDimensions: string[];
}

export type DeepReviewTab = 'argument' | 'evidence' | 'structure' | 'style';

const POSITIVE_CATEGORIES = new Set([
  'strong_argument',
  'strong_evidence',
  'strong_structure',
  'strong_prose',
]);

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractJsonText(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  const objectMatch = text.match(/\{[\s\S]*/);
  const arrayMatch = text.match(/\[[\s\S]*/);
  const jsonText = objectMatch?.[0] || arrayMatch?.[0];
  if (!jsonText) {
    throw new Error('No JSON found in AI response');
  }

  return jsonText;
}

function repairTruncatedJson(jsonText: string): string | null {
  let repaired = jsonText.trim();

  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;

  if (repaired.includes('"comments"') && openBrackets > closeBrackets) {
    const lastCompleteObject = repaired.lastIndexOf('}');
    if (lastCompleteObject > repaired.indexOf('"comments"')) {
      repaired = repaired.slice(0, lastCompleteObject + 1);
    }
    repaired += ']'.repeat(openBrackets - closeBrackets);
  }

  repaired += '}'.repeat(Math.max(0, openBraces - (repaired.match(/\}/g) || []).length));

  try {
    JSON.parse(repaired);
    return repaired;
  } catch {
    return null;
  }
}

function extractCommentsFromRaw(raw: string): DeepReviewComment[] {
  const comments: DeepReviewComment[] = [];
  const pattern =
    /\{\s*"quote"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"category"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"comment"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"suggestion"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;

  let match = pattern.exec(raw);
  while (match) {
    comments.push({
      quote: match[1].replace(/\\"/g, '"'),
      category: match[2],
      comment: match[3].replace(/\\"/g, '"'),
      suggestion: match[4].replace(/\\"/g, '"'),
    });
    match = pattern.exec(raw);
  }

  return comments;
}

export function parseClaudeJson<T>(raw: string): T {
  const jsonText = extractJsonText(raw);

  try {
    return JSON.parse(jsonText) as T;
  } catch (firstError: any) {
    const repaired = repairTruncatedJson(jsonText);
    if (repaired) {
      try {
        return JSON.parse(repaired) as T;
      } catch {
        // fall through to comment extraction
      }
    }

    if (jsonText.includes('"comments"')) {
      const comments = extractCommentsFromRaw(raw);
      if (comments.length > 0) {
        return { comments } as T;
      }
    }

    const message = firstError?.message || 'Unknown parse error';
    if (message.includes('JSON')) {
      throw new Error(
        'AI response was cut off or malformed. Partial results could not be recovered — try again, or review a shorter draft section.'
      );
    }

    throw firstError;
  }
}

export function isPositiveCategory(category: string): boolean {
  return POSITIVE_CATEGORIES.has(category);
}

export function extractAllQuotes(results: DeepReviewResults): string[] {
  const quotes = new Set<string>();
  for (const dimension of ['argument', 'evidence', 'structure', 'style'] as const) {
    for (const item of results[dimension].comments) {
      if (item.quote?.trim()) {
        quotes.add(item.quote.trim());
      }
    }
  }
  return Array.from(quotes);
}

export function buildExportReport(results: DeepReviewResults, draftTitle: string): string {
  const lines: string[] = [
    `Deep Review Report — ${draftTitle}`,
    `Generated: ${new Date().toLocaleString()}`,
    '',
    '=== OVERALL ASSESSMENT ===',
    `Score: ${results.overall.overallScore ?? 'N/A'}/10`,
    results.overall.summary || results.overall.error || 'Unavailable',
    '',
    'Strengths:',
    ...(results.overall.topStrengths?.map((s) => `  • ${s}`) || ['  (none)']),
    '',
    'Weaknesses:',
    ...(results.overall.topWeaknesses?.map((s) => `  • ${s}`) || ['  (none)']),
    '',
    'Priority Revisions:',
    ...(results.overall.priorityRevisions?.map((s) => `  • ${s}`) || ['  (none)']),
    '',
  ];

  const sections: Array<{ label: string; key: keyof Pick<DeepReviewResults, 'argument' | 'evidence' | 'structure' | 'style'> }> = [
    { label: 'ARGUMENT & LOGIC', key: 'argument' },
    { label: 'EVIDENCE & CITATIONS', key: 'evidence' },
    { label: 'STRUCTURE & FLOW', key: 'structure' },
    { label: 'ACADEMIC TONE & STYLE', key: 'style' },
  ];

  for (const { label, key } of sections) {
    lines.push(`=== ${label} ===`);
    const dimension = results[key];
    if (dimension.error) {
      lines.push(`Error: ${dimension.error}`);
      lines.push('');
      continue;
    }
    if (dimension.comments.length === 0) {
      lines.push('No comments.');
      lines.push('');
      continue;
    }
    dimension.comments.forEach((item, idx) => {
      lines.push(`${idx + 1}. [${item.category}] "${item.quote}"`);
      lines.push(`   Comment: ${item.comment}`);
      lines.push(`   Suggestion: ${item.suggestion}`);
      lines.push('');
    });
  }

  if (results.failedDimensions.length > 0) {
    lines.push('=== NOTES ===');
    lines.push(`Failed dimensions: ${results.failedDimensions.join(', ')}`);
  }

  return lines.join('\n');
}

export function downloadTextReport(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const JSON_RULES =
  'Return at most 6 comments. Output ONLY raw valid JSON with no markdown fences. Keep each comment concise.';

export const DEEP_REVIEW_PROMPTS = {
  argument: `You are a rigorous academic reviewer. Analyze this thesis draft for logical structure and argument quality. For each issue found, return an inline comment with the EXACT quote from the text (up to 20 words) where the issue occurs, a category ('logic_gap' | 'unsupported_claim' | 'circular_reasoning' | 'strong_argument'), and a specific actionable suggestion. Return JSON: { "comments": [{ "quote": string, "category": string, "comment": string, "suggestion": string }] }. ${JSON_RULES}`,
  evidence: `You are an academic writing expert. Analyze this draft for evidence usage. Find claims that need citations, places where evidence is misused or overgeneralized, and strong uses of evidence. Return JSON: { "comments": [{ "quote": string, "category": "needs_citation" | "evidence_misuse" | "strong_evidence", "comment": string, "suggestion": string }] }. ${JSON_RULES}`,
  structure: `Analyze the structural coherence of this thesis draft. Look at paragraph transitions, section organization, topic sentence clarity, and overall flow. Return JSON: { "comments": [{ "quote": string, "category": "weak_transition" | "structure_issue" | "unclear_topic_sentence" | "strong_structure", "comment": string, "suggestion": string }] }. ${JSON_RULES}`,
  style: `Analyze this academic draft for tone, style, and voice. Flag passive voice overuse, hedging language issues, informal tone, jargon problems, and strong academic writing. Return JSON: { "comments": [{ "quote": string, "category": "informal_tone" | "weak_hedging" | "strong_prose" | "clarity_issue", "comment": string, "suggestion": string }] }. ${JSON_RULES}`,
  overall: `Give an overall academic quality assessment of this thesis draft. Return JSON: { "overallScore": number (1-10), "summary": string (2-3 sentences), "topStrengths": string[] (3 items), "topWeaknesses": string[] (3 items), "priorityRevisions": string[] (top 3 specific things to fix first) }. Output ONLY raw valid JSON with no markdown fences.`,
} as const;

export const DEEP_REVIEW_MAX_DRAFT_CHARS = 12000;

export const DIMENSION_LABELS: Record<DeepReviewTab, string> = {
  argument: 'Argument',
  evidence: 'Evidence',
  structure: 'Structure',
  style: 'Style',
};
