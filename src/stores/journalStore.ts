import { create } from 'zustand';
import { db } from '../utils/db';
import type { JournalEntry } from '../types';
import { autosaveManager } from '../utils/autosave';

interface JournalState {
  entries: JournalEntry[];
  isLoading: boolean;
  selectedEntry: JournalEntry | null;
  fetchEntries: () => Promise<void>;
  getEntry: (id: string) => Promise<JournalEntry | undefined>;
  getEntryByDate: (date: string) => Promise<JournalEntry | undefined>;
  createEntry: (entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateEntry: (id: string, updates: Partial<JournalEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  searchEntries: (query: string) => Promise<JournalEntry[]>;
  getEntriesByDateRange: (startDate: string, endDate: string) => Promise<JournalEntry[]>;
  setSelectedEntry: (entry: JournalEntry | null) => void;
}

export const useJournalStore = create<JournalState>((set, get) => ({
  entries: [],
  isLoading: false,
  selectedEntry: null,

  fetchEntries: async () => {
    set({ isLoading: true });
    try {
      const entries = await db.journalEntries.orderBy('date').reverse().toArray();
      set({ entries, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch journal entries:', error);
      set({ isLoading: false });
    }
  },

  getEntry: async (id: string) => {
    return await db.journalEntries.get(id);
  },

  getEntryByDate: async (date: string) => {
    const entries = await db.journalEntries.where('date').equals(date).toArray();
    return entries[0];
  },

  createEntry: async (entryData) => {
    const now = new Date().toISOString();
    const entry: JournalEntry = {
      ...entryData,
      id: crypto.randomUUID(),
      linkedItemIds: entryData.linkedItemIds || [],
      createdAt: now,
      updatedAt: now,
    };

    await db.journalEntries.add(entry);
    await get().fetchEntries();
    return entry.id;
  },

  updateEntry: async (id, updates) => {
    const updatesWithTimestamp = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    autosaveManager.trigger(`journal-${id}`);
    autosaveManager.register(`journal-${id}`, async () => {
      await db.journalEntries.update(id, updatesWithTimestamp);
      await get().fetchEntries();
      if (get().selectedEntry?.id === id) {
        const updated = await db.journalEntries.get(id);
        if (updated) set({ selectedEntry: updated });
      }
    });
  },

  deleteEntry: async (id) => {
    await db.journalEntries.delete(id);
    await get().fetchEntries();
    if (get().selectedEntry?.id === id) {
      set({ selectedEntry: null });
    }
  },

  searchEntries: async (query) => {
    const lowerQuery = query.toLowerCase();
    return await db.journalEntries
      .filter((entry) => {
        return (
          entry.content.toLowerCase().includes(lowerQuery) ||
          entry.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
        );
      })
      .toArray();
  },

  getEntriesByDateRange: async (startDate, endDate) => {
    return await db.journalEntries
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  },

  setSelectedEntry: (entry) => {
    set({ selectedEntry: entry });
  },
}));
