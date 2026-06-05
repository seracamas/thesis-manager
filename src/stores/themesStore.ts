import { create } from 'zustand';
import { db, initializeDatabase } from '../utils/db';
import type { Theme } from '../types';
import { autosaveManager } from '../utils/autosave';

interface ThemesState {
  themes: Theme[];
  isLoading: boolean;
  selectedTheme: Theme | null;
  fetchThemes: () => Promise<void>;
  getTheme: (id: string) => Promise<Theme | undefined>;
  createTheme: (theme: Omit<Theme, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateTheme: (id: string, updates: Partial<Theme>) => Promise<void>;
  deleteTheme: (id: string) => Promise<void>;
  searchThemes: (query: string) => Promise<Theme[]>;
  setSelectedTheme: (theme: Theme | null) => void;
}

export const useThemesStore = create<ThemesState>((set, get) => ({
  themes: [],
  isLoading: false,
  selectedTheme: null,

  fetchThemes: async () => {
    set({ isLoading: true });
    try {
      await initializeDatabase();
      const themes = await db.themes.orderBy('createdAt').reverse().toArray();
      // Convert numeric IDs to strings for compatibility with Theme interface
      const themesWithStringIds = themes.map(theme => ({
        ...theme,
        id: String(theme.id),
        parentThemeId: theme.parentThemeId ? String(theme.parentThemeId) : null,
      }));
      set({ themes: themesWithStringIds as Theme[], isLoading: false });
    } catch (error) {
      console.error('Failed to fetch themes:', error);
      set({ isLoading: false });
    }
  },

  getTheme: async (id: string) => {
    const theme = await db.themes.get(Number(id));
    if (!theme) return undefined;
    // Convert numeric ID to string for compatibility
    return {
      ...theme,
      id: String(theme.id),
      parentThemeId: theme.parentThemeId ? String(theme.parentThemeId) : null,
    } as Theme;
  },

  createTheme: async (themeData) => {
    await initializeDatabase();
    const now = new Date().toISOString();
    // Create theme object without id - Dexie will auto-generate numeric ID
    const themeToAdd: any = {
      ...themeData,
      parentThemeId: themeData.parentThemeId ? Number(themeData.parentThemeId) : null,
      interviewIds: themeData.interviewIds || [],
      occurrenceCount: themeData.occurrenceCount || 0,
      createdAt: now,
      updatedAt: now,
    };

    // Add returns the auto-generated numeric ID
    const numericId = await db.themes.add(themeToAdd);
    
    // Fetch themes to update the store
    await get().fetchThemes();
    
    // Return numeric ID as string for compatibility
    return String(numericId);
  },

  updateTheme: async (id, updates) => {
    const numericId = Number(id);
    const updatesWithTimestamp: any = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    // Convert parentThemeId to number if provided
    if (updates.parentThemeId !== undefined) {
      updatesWithTimestamp.parentThemeId = updates.parentThemeId ? Number(updates.parentThemeId) : null;
    }

    autosaveManager.trigger(`theme-${id}`);
    autosaveManager.register(`theme-${id}`, async () => {
      await db.themes.update(numericId, updatesWithTimestamp);
      await get().fetchThemes();
      if (get().selectedTheme?.id === id) {
        const updated = await db.themes.get(numericId);
        if (updated) {
          set({ 
            selectedTheme: {
              ...updated,
              id: String(updated.id),
              parentThemeId: updated.parentThemeId ? String(updated.parentThemeId) : null,
            } as Theme
          });
        }
      }
    });
  },

  deleteTheme: async (id) => {
    const numericId = Number(id);
    await db.themes.delete(numericId);
    await get().fetchThemes();
    if (get().selectedTheme?.id === id) {
      set({ selectedTheme: null });
    }
  },

  searchThemes: async (query) => {
    const lowerQuery = query.toLowerCase();
    const themes = await db.themes
      .filter((theme) => {
        return !!(
          theme.name.toLowerCase().includes(lowerQuery) ||
          theme.description?.toLowerCase().includes(lowerQuery) ||
          theme.memo?.toLowerCase().includes(lowerQuery)
        );
      })
      .toArray();
    // Convert numeric IDs to strings for compatibility
    return themes.map(theme => ({
      ...theme,
      id: String(theme.id),
      parentThemeId: theme.parentThemeId ? String(theme.parentThemeId) : null,
    })) as Theme[];
  },

  setSelectedTheme: (theme) => {
    set({ selectedTheme: theme });
  },
}));
