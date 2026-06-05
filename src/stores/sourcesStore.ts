import { create } from 'zustand';
import { db, resetDatabase } from '../utils/db';
import type { Source } from '../types';
import { autosaveManager } from '../utils/autosave';

interface SourcesState {
  sources: Source[];
  isLoading: boolean;
  selectedSource: Source | null;
  fetchSources: () => Promise<void>;
  getSource: (id: string) => Promise<Source | undefined>;
  createSource: (source: Omit<Source, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateSource: (id: string, updates: Partial<Source>) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;
  searchSources: (query: string) => Promise<Source[]>;
  setSelectedSource: (source: Source | null) => void;
}

export const useSourcesStore = create<SourcesState>((set, get) => ({
  sources: [],
  isLoading: false,
  selectedSource: null,

  fetchSources: async () => {
    set({ isLoading: true });
    try {
      // New schema uses createdAt instead of updatedAt
      const sources = await db.sources.orderBy('createdAt').reverse().toArray();
      set({ sources, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch sources:', error);
      set({ isLoading: false });
    }
  },

  getSource: async (id: string) => {
    return await db.sources.get(id);
  },

  createSource: async (sourceData) => {
    try {
      // Validate required fields
      if (!sourceData.title || !sourceData.title.trim()) {
        throw new Error('Source title is required');
      }
      if (!sourceData.authors || sourceData.authors.length === 0) {
        // Set default author if none provided
        sourceData.authors = ['Unknown Author'];
      }
      if (!sourceData.date) {
        sourceData.date = new Date().toISOString().split('T')[0];
      }
      if (!sourceData.type) {
        sourceData.type = 'article';
      }
      if (!sourceData.citation) {
        sourceData.citation = `${sourceData.authors.join(', ')} (${new Date(sourceData.date).getFullYear()}). ${sourceData.title}.`;
      }
      
      const now = new Date().toISOString();
      const source: Source = {
        ...sourceData,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        tags: sourceData.tags || [],
      };

      await db.sources.add(source);
      await get().fetchSources();
      return source.id;
    } catch (error: any) {
      console.error('createSource error:', error);
      
      // Handle database constraint errors by automatically resetting
      if (error.name === 'ConstraintError' || 
          error.message?.includes('index') || 
          error.message?.includes('already exists') ||
          error.message?.includes('constraint')) {
        console.error('Database constraint error detected. Attempting automatic recovery...');
        try {
          // Try to reset the database automatically
          await resetDatabase();
          // Retry the operation after reset
          const now = new Date().toISOString();
          const source: Source = {
            ...sourceData,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
            tags: sourceData.tags || [],
          };
          await db.sources.add(source);
          await get().fetchSources();
          console.log('Database recovered successfully');
          return source.id;
        } catch (recoveryError: any) {
          console.error('Automatic recovery failed:', recoveryError);
          throw new Error('Database error. Please go to Settings and click "Reset Database" to fix this issue.');
        }
      }
      
      // Re-throw with a more user-friendly message
      if (error.message && !error.message.includes('Database error')) {
        throw new Error(`Failed to create source: ${error.message}`);
      }
      throw error;
    }
  },

  updateSource: async (id, updates) => {
    const updatesWithTimestamp = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    autosaveManager.trigger(`source-${id}`);
    autosaveManager.register(`source-${id}`, async () => {
      await db.sources.update(id, updatesWithTimestamp);
      await get().fetchSources();
      if (get().selectedSource?.id === id) {
        const updated = await db.sources.get(id);
        if (updated) set({ selectedSource: updated });
      }
    });
  },

  deleteSource: async (id) => {
    await db.sources.delete(id);
    await get().fetchSources();
    if (get().selectedSource?.id === id) {
      set({ selectedSource: null });
    }
  },

  searchSources: async (query) => {
    const lowerQuery = query.toLowerCase();
    return await db.sources
      .filter((source) => {
        return (
          source.title.toLowerCase().includes(lowerQuery) ||
          source.authors.some((author) => author.toLowerCase().includes(lowerQuery)) ||
          source.citation?.toLowerCase().includes(lowerQuery) ||
          source.notes?.toLowerCase().includes(lowerQuery) ||
          source.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
        );
      })
      .toArray();
  },

  setSelectedSource: (source) => {
    set({ selectedSource: source });
  },
}));
