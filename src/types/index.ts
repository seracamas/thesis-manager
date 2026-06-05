export interface Source {
  id: string;
  title: string;
  authors: string[];
  date: string;
  type: 'book' | 'article' | 'website' | 'thesis' | 'conference' | 'book-chapter' | 'other';
  citation: string;
  url?: string;
  notes?: string;
  tags: string[];
  // Citation machine fields
  summary?: string; // AI-generated summary
  journal?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  sourceId?: string;
  linkedNoteIds: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Interview {
  id: string;
  interviewee: string;
  privacyCode?: string;
  date: string;
  location?: string;
  type: string;
  transcript: string;
  highlights: InterviewHighlight[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InterviewHighlight {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  theme: string;
  linkedNoteId?: string;
}

export interface DataFile {
  id: string;
  name: string;
  type: 'csv' | 'excel' | 'image' | 'pdf' | 'other';
  fileData?: Blob;
  metadata: Record<string, any>;
  folder?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  content: string;
  tags: string[];
  linkedItemIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Draft {
  id: string;
  title: string;
  content: string;
  parentId?: string;
  status: 'outline' | 'draft' | 'revision' | 'final';
  wordCount: number;
  versions: DraftVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface DraftVersion {
  id: string;
  content: string;
  createdAt: string;
  note?: string;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  color: string;
  memo?: string;
  parentThemeId?: string | null; // for sub-themes
  interviewIds: string[]; // which interviews this appears in (auto-updated)
  occurrenceCount: number; // auto-updated
  createdAt: string;
  updatedAt: string;
}

export interface ThemeOccurrence {
  id: string;
  themeId: string;
  interviewId: string;
  interviewTitle: string;
  passageText: string; // the exact highlighted text
  passageContext: string; // 1-2 sentences before and after for context
  startIndex: number; // position in transcript
  endIndex: number;
  note?: string; // optional analyst note
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  type: 'source' | 'note' | 'interview' | 'data' | 'journal' | 'draft' | 'theme';
  itemId: string;
  action: 'created' | 'updated';
  timestamp: string;
}

export interface ArticleResult {
  id: string;
  title: string;
  authors: { name: string }[];
  year: number;
  journal?: string;
  abstract?: string;
  doi?: string;
  url?: string;
  citationCount?: number;
  isOpenAccess?: boolean;
  aiSummary?: string;
  isAdded?: boolean; // tracks if already saved to sources
}

export interface InterviewRequest {
  id: string;
  participantName: string;
  participantEmail: string;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
  proposedTimes: string[]; // ISO datetime strings
  confirmedTime: string | null;
  duration: number; // minutes, default 60
  notes: string;
  calendarEventId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableWindow {
  start: Date;
  end: Date;
  durationMinutes: number;
  hasMeetingsBefore?: boolean;
  hasMeetingsAfter?: boolean;
}
