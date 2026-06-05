import { askClaude } from './claudeClient';

export interface ParsedScheduleRequest {
  task: string;
  durationMinutes: number;
  timeframe: string; // 'today' | 'this week' | 'before [date]' | etc.
  preferences?: string; // 'morning' | 'afternoon' | 'evening' | 'no meetings before/after'
}

/**
 * Parse natural language scheduling request using Claude
 */
export async function parseScheduleRequest(
  userMessage: string
): Promise<ParsedScheduleRequest> {
  const prompt = `Extract the following from this scheduling request:
- task name (what the user wants to do)
- duration in minutes (convert hours to minutes, e.g., "3 hours" = 180)
- preferred timeframe (today / this week / before [date] / etc.)
- any preferences (morning, afternoon, evening, no meetings before/after)

Return ONLY a JSON object: { task, durationMinutes, timeframe, preferences }

User request: "${userMessage}"`;

  try {
    const text = (await askClaude(prompt, undefined, 512)).trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        task: parsed.task || 'Thesis Work',
        durationMinutes: parsed.durationMinutes || 120,
        timeframe: parsed.timeframe || 'this week',
        preferences: parsed.preferences,
      };
    }
    
    // Fallback
    return {
      task: 'Thesis Work',
      durationMinutes: 120,
      timeframe: 'this week',
    };
  } catch (error: any) {
    console.error('Error parsing schedule request:', error);
    throw new Error(`Failed to parse schedule request: ${error.message}`);
  }
}

/**
 * Convert timeframe string to date range
 */
export function timeframeToDateRange(timeframe: string): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  
  let end = new Date(start);
  
  if (timeframe.toLowerCase().includes('today')) {
    end.setHours(23, 59, 59, 999);
  } else if (timeframe.toLowerCase().includes('tomorrow')) {
    start.setDate(start.getDate() + 1);
    end = new Date(start);
    end.setHours(23, 59, 59, 999);
  } else if (timeframe.toLowerCase().includes('this week')) {
    end.setDate(start.getDate() + 7);
  } else if (timeframe.toLowerCase().includes('next week')) {
    start.setDate(start.getDate() + 7);
    end.setDate(start.getDate() + 7);
  } else if (timeframe.toLowerCase().includes('before')) {
    // Try to extract date
    const dateMatch = timeframe.match(/(\d{1,2})\/(\d{1,2})|(\w+day)/i);
    if (dateMatch) {
      // Simple parsing - can be enhanced
      end.setDate(start.getDate() + 14); // Default to 2 weeks
    } else {
      end.setDate(start.getDate() + 14);
    }
  } else {
    // Default to 2 weeks
    end.setDate(start.getDate() + 14);
  }
  
  return { start, end };
}
