import Dexie, { Table } from 'dexie';

export interface Source {
  id?: number;
  title: string;
  authors: string[];
  year: number;
  journal?: string;
  doi?: string;
  url?: string;
  summary?: string;
  citationCount?: number;
  type?: string;
  tags?: string[];
  createdAt: string;
}

export interface Interview {
  id?: number;
  interviewee: string;
  privacyCode?: string;
  date: string;
  location?: string;
  type: string;
  transcript: string;
  highlights?: Array<{
    id: string;
    text: string;
    startIndex: number;
    endIndex: number;
    theme: string;
    linkedNoteId?: string;
  }>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InterviewRequest {
  id?: number;
  participantName: string;
  participantEmail: string;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
  proposedTimes?: string[];
  confirmedTime?: string;
  duration?: number;
  notes?: string;
  calendarEventId?: string;
  createdAt: string;
}

export interface Theme {
  id?: number;
  name: string;
  description?: string;
  color: string;
  parentThemeId?: number;
  interviewIds?: string[];
  occurrenceCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeOccurrence {
  id?: number;
  themeId: number;
  interviewId: number;
  interviewTitle: string;
  passageText: string;
  passageContext?: string;
  startIndex?: number;
  endIndex?: number;
  note?: string;
  createdAt: string;
}

export interface PinnedItem {
  id?: number;
  type: string;
  referenceId: number;
  note?: string;
  createdAt: string;
}

export interface Todo {
  id?: number;
  text: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  category: 'thesis' | 'interview' | 'research' | 'other';
  createdAt: string;
}

export interface Draft {
  id?: number;
  title: string;
  content: string;
  originalPDF?: ArrayBuffer;
  type: 'pdf' | 'text';
  parentId?: number;
  status: 'outline' | 'draft' | 'revision' | 'final';
  wordCount: number;
  fileSize?: number;
  pageCount?: number;
  versions: Array<{
    id: string;
    content: string;
    createdAt: string;
    note?: string;
  }>;
  shareLink?: string;
  sharedWith?: Array<{
    email: string;
    role: 'viewer' | 'commenter';
    addedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface DataFile {
  id: string;
  name: string;
  type: 'csv' | 'excel' | 'image' | 'pdf' | 'other';
  fileData?: Blob;
  metadata: Record<string, unknown>;
  folder?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id?: number;
  draftId: number;
  selectedText: string;
  commentText: string;
  pageNumber?: number;
  positionY: number;
  resolved: boolean;
  authorName: string;
  replies: Array<{
    text: string;
    author: string;
    createdAt: string;
  }>;
  commentType: 'user' | 'ai' | 'citation';
  suggestionType?: 'clarity' | 'tone' | 'argument' | 'evidence' | 'flow';
  revisedText?: string;
  createdAt: string;
}

class ThesisDB extends Dexie {
  sources!: Table<Source>;
  interviews!: Table<Interview>;
  interviewRequests!: Table<InterviewRequest>;
  themes!: Table<Theme>;
  themeOccurrences!: Table<ThemeOccurrence>;
  pinnedItems!: Table<PinnedItem>;
  todos!: Table<Todo>;
  drafts!: Table<Draft>;
  comments!: Table<Comment>;
  dataFiles!: Table<DataFile>;

  constructor() {
    super('ThesisResearchDB');
    this.version(1).stores({
      sources: '++id, title, doi, url, createdAt',
      interviews: '++id, title, date, createdAt',
      interviewRequests: '++id, status, participantEmail, createdAt',
      themes: '++id, name, createdAt',
      themeOccurrences: '++id, themeId, interviewId, createdAt',
      pinnedItems: '++id, type, referenceId, createdAt',
    });
    
    // Version 2: Add todos table
    this.version(2).stores({
      sources: '++id, title, doi, url, createdAt',
      interviews: '++id, title, date, createdAt',
      interviewRequests: '++id, status, participantEmail, createdAt',
      themes: '++id, name, createdAt',
      themeOccurrences: '++id, themeId, interviewId, createdAt',
      pinnedItems: '++id, type, referenceId, createdAt',
      todos: '++id, completed, priority, dueDate, category, createdAt',
    });
    
    // Version 3: Update interviews schema to include updatedAt and new fields
    this.version(3).stores({
      sources: '++id, title, doi, url, createdAt',
      interviews: '++id, interviewee, date, createdAt, updatedAt',
      interviewRequests: '++id, status, participantEmail, createdAt',
      themes: '++id, name, createdAt',
      themeOccurrences: '++id, themeId, interviewId, createdAt',
      pinnedItems: '++id, type, referenceId, createdAt',
      todos: '++id, completed, priority, dueDate, category, createdAt',
    });
    
    // Version 4: Add drafts and comments tables
    this.version(4).stores({
      sources: '++id, title, doi, url, createdAt',
      interviews: '++id, interviewee, date, createdAt, updatedAt',
      interviewRequests: '++id, status, participantEmail, createdAt',
      themes: '++id, name, createdAt',
      themeOccurrences: '++id, themeId, interviewId, createdAt',
      pinnedItems: '++id, type, referenceId, createdAt',
      todos: '++id, completed, priority, dueDate, category, createdAt',
      drafts: '++id, title, type, status, parentId, shareLink, createdAt, updatedAt',
      comments: '++id, draftId, resolved, createdAt',
    });

    // Version 5: Add dataFiles table for Data page uploads
    this.version(5).stores({
      sources: '++id, title, doi, url, createdAt',
      interviews: '++id, interviewee, date, createdAt, updatedAt',
      interviewRequests: '++id, status, participantEmail, createdAt',
      themes: '++id, name, createdAt',
      themeOccurrences: '++id, themeId, interviewId, createdAt',
      pinnedItems: '++id, type, referenceId, createdAt',
      todos: '++id, completed, priority, dueDate, category, createdAt',
      drafts: '++id, title, type, status, parentId, shareLink, createdAt, updatedAt',
      comments: '++id, draftId, resolved, createdAt',
      dataFiles: 'id, name, type, folder, createdAt, updatedAt',
    });
  }
}

export const db = new ThesisDB();

// Initialize database
let dbInitialized = false;

export async function initializeDatabase(): Promise<void> {
  if (dbInitialized) return;
  
  try {
    if (db.isOpen()) {
      await db.close();
    }
    
    await db.open();
    dbInitialized = true;
    console.log('✅ Database initialized successfully');
  } catch (error: any) {
    console.error('❌ Database open error:', error);
    dbInitialized = false;
    throw error;
  }
}

// Reset database function
export async function resetDatabase(): Promise<void> {
  try {
    dbInitialized = false;
    
    if (db.isOpen()) {
      await db.close();
    }
    
    const deletePromise = new Promise<void>((resolve, reject) => {
      try {
        const deleteRequest = indexedDB.deleteDatabase('ThesisResearchDB');
        
        deleteRequest.onsuccess = () => {
          console.log('Database deletion successful');
          resolve();
        };
        
        deleteRequest.onerror = () => {
          console.error('Database deletion error:', deleteRequest.error);
          reject(deleteRequest.error);
        };
        
        deleteRequest.onblocked = () => {
          console.warn('Database deletion blocked - this may take a moment...');
          setTimeout(() => {
            resolve();
          }, 3000);
        };
      } catch (e) {
        console.error('Error initiating database deletion:', e);
        reject(e);
      }
    });
    
    await Promise.race([
      deletePromise,
      new Promise<void>((resolve) => setTimeout(() => {
        console.warn('Database deletion timeout - proceeding with reload');
        resolve();
      }, 5000))
    ]);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Clear localStorage entries
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('dexie') || key.includes('ThesisResearchDB') || key.includes('db-')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Error clearing localStorage:', e);
    }
    
    window.location.href = window.location.origin + window.location.pathname;
    
  } catch (error) {
    console.error('Failed to reset database:', error);
    alert('Database reset initiated. If the issue persists after reload, please manually delete the database:\n\n1. Press F12\n2. Go to Application tab\n3. Find IndexedDB → ThesisResearchDB\n4. Right-click and Delete\n5. Refresh the page');
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  }
}

// Helper functions for search indexing
export const searchableFields = {
  sources: ['title', 'authors', 'summary'] as const,
  interviews: ['title', 'participantName', 'transcript'] as const,
  themes: ['name', 'description'] as const,
};
