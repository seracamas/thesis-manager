import { create } from 'zustand';
import { db, initializeDatabase } from '../utils/db';
import type { ThemeOccurrence, Theme } from '../types';

interface ThemeOccurrencesState {
  occurrences: ThemeOccurrence[];
  isLoading: boolean;
  fetchOccurrences: () => Promise<void>;
  getOccurrence: (id: string) => Promise<ThemeOccurrence | undefined>;
  createOccurrence: (occurrence: Omit<ThemeOccurrence, 'id' | 'createdAt'>) => Promise<string>;
  updateOccurrence: (id: string, updates: Partial<ThemeOccurrence>) => Promise<void>;
  deleteOccurrence: (id: string) => Promise<void>;
  getOccurrencesByTheme: (themeId: string) => Promise<ThemeOccurrence[]>;
  getOccurrencesByInterview: (interviewId: string) => Promise<ThemeOccurrence[]>;
  // Auto-update theme stats when occurrences change
  updateThemeStats: (themeId: string) => Promise<void>;
}

export const useThemeOccurrencesStore = create<ThemeOccurrencesState>((set, get) => ({
  occurrences: [],
  isLoading: false,

  fetchOccurrences: async () => {
    set({ isLoading: true });
    try {
      const occurrences = await db.themeOccurrences.orderBy('createdAt').reverse().toArray();
      set({ occurrences, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch theme occurrences:', error);
      set({ isLoading: false });
    }
  },

  getOccurrence: async (id: string) => {
    return await db.themeOccurrences.get(Number(id));
  },

  createOccurrence: async (occurrenceData) => {
    await initializeDatabase();
    const now = new Date().toISOString();
    const occurrence = {
      ...occurrenceData,
      themeId: Number(occurrenceData.themeId),
      interviewId: Number(occurrenceData.interviewId),
      createdAt: now,
    };

    const id = await db.themeOccurrences.add(occurrence);
    
    // Update theme stats
    await get().updateThemeStats(String(occurrence.themeId));
    
    await get().fetchOccurrences();
    return String(id); // Return as string for compatibility
  },

  updateOccurrence: async (id, updates) => {
    const idNum = Number(id);
    const occurrence = await db.themeOccurrences.get(idNum);
    if (!occurrence) return;

    await db.themeOccurrences.update(idNum, updates);
    
    // Update theme stats if themeId changed
    if (updates.themeId && updates.themeId !== occurrence.themeId) {
      await get().updateThemeStats(String(occurrence.themeId)); // old theme
      await get().updateThemeStats(String(updates.themeId)); // new theme
    } else {
      await get().updateThemeStats(String(occurrence.themeId));
    }
    
    await get().fetchOccurrences();
  },

  deleteOccurrence: async (id) => {
    const idNum = Number(id);
    const occurrence = await db.themeOccurrences.get(idNum);
    if (!occurrence) return;

    const themeId = occurrence.themeId;
    await db.themeOccurrences.delete(idNum);
    
    // Update theme stats
    await get().updateThemeStats(String(themeId));
    
    await get().fetchOccurrences();
  },

  getOccurrencesByTheme: async (themeId: string) => {
    // Convert string to number for new schema
    const themeIdNum = Number(themeId);
    return await db.themeOccurrences.where('themeId').equals(themeIdNum).toArray();
  },

  getOccurrencesByInterview: async (interviewId: string) => {
    const interviewIdNum = Number(interviewId);
    return await db.themeOccurrences.where('interviewId').equals(interviewIdNum).toArray();
  },

  updateThemeStats: async (themeId: string) => {
    // Get all occurrences for this theme
    const themeIdNum = Number(themeId);
    const occurrences = await db.themeOccurrences.where('themeId').equals(themeIdNum).toArray();
    
    // Get unique interview IDs
    const interviewIds = [...new Set(occurrences.map(o => o.interviewId))];
    
    // Get the current theme to preserve other fields
    const theme = await db.themes.get(themeIdNum);
    if (!theme) {
      console.warn(`Theme ${themeIdNum} not found when updating stats`);
      return;
    }
    
    // Update theme with new stats
    await db.themes.update(themeIdNum, {
      occurrenceCount: occurrences.length,
      interviewIds: interviewIds.map(id => String(id)), // Convert to strings for storage
      updatedAt: new Date().toISOString(),
    });
    
    // Trigger a refresh of themes in the store if needed
    // This ensures the Themes page updates immediately
  },
}));
