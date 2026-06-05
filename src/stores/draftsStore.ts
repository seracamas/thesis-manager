import { create } from 'zustand';
import { db } from '../utils/db';
import type { Draft, DraftVersion } from '../types';
import { autosaveManager } from '../utils/autosave';

interface DraftsState {
  drafts: Draft[];
  isLoading: boolean;
  selectedDraft: Draft | null;
  fetchDrafts: () => Promise<void>;
  getDraft: (id: string) => Promise<Draft | undefined>;
  getDraftsByParent: (parentId: string) => Promise<Draft[]>;
  createDraft: (draft: Omit<Draft, 'id' | 'wordCount' | 'versions' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateDraft: (id: string, updates: Partial<Draft>) => Promise<void>;
  deleteDraft: (id: string) => Promise<void>;
  searchDrafts: (query: string) => Promise<Draft[]>;
  saveVersion: (id: string, note?: string) => Promise<void>;
  setSelectedDraft: (draft: Draft | null) => void;
  calculateWordCount: (content: string) => number;
}

export const useDraftsStore = create<DraftsState>((set, get) => ({
  drafts: [],
  isLoading: false,
  selectedDraft: null,

  fetchDrafts: async () => {
    set({ isLoading: true });
    try {
      const drafts = await db.drafts.orderBy('updatedAt').reverse().toArray();
      set({ drafts, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch drafts:', error);
      set({ isLoading: false });
    }
  },

  getDraft: async (id: string) => {
    return await db.drafts.get(id);
  },

  getDraftsByParent: async (parentId: string) => {
    return await db.drafts.where('parentId').equals(parentId).toArray();
  },

  createDraft: async (draftData) => {
    const now = new Date().toISOString();
    const content = draftData.content || '';
    const wordCount = get().calculateWordCount(content);
    
    const draft: Draft = {
      ...draftData,
      id: crypto.randomUUID(),
      wordCount,
      versions: [],
      createdAt: now,
      updatedAt: now,
    };

    await db.drafts.add(draft);
    await get().fetchDrafts();
    return draft.id;
  },

  updateDraft: async (id, updates) => {
    const draft = await db.drafts.get(id);
    if (!draft) return;

    const content = updates.content !== undefined ? updates.content : draft.content;
    const wordCount = get().calculateWordCount(content);

    const updatesWithTimestamp = {
      ...updates,
      wordCount,
      updatedAt: new Date().toISOString(),
    };

    autosaveManager.trigger(`draft-${id}`);
    autosaveManager.register(`draft-${id}`, async () => {
      await db.drafts.update(id, updatesWithTimestamp);
      await get().fetchDrafts();
      if (get().selectedDraft?.id === id) {
        const updated = await db.drafts.get(id);
        if (updated) set({ selectedDraft: updated });
      }
    });
  },

  deleteDraft: async (id) => {
    // Also delete child drafts
    const children = await db.drafts.where('parentId').equals(id).toArray();
    for (const child of children) {
      await db.drafts.delete(child.id);
    }

    await db.drafts.delete(id);
    await get().fetchDrafts();
    if (get().selectedDraft?.id === id) {
      set({ selectedDraft: null });
    }
  },

  searchDrafts: async (query) => {
    const lowerQuery = query.toLowerCase();
    return await db.drafts
      .filter((draft) => {
        return (
          draft.title.toLowerCase().includes(lowerQuery) ||
          draft.content.toLowerCase().includes(lowerQuery)
        );
      })
      .toArray();
  },

  saveVersion: async (id, note) => {
    const draft = await db.drafts.get(id);
    if (!draft) return;

    const version: DraftVersion = {
      id: crypto.randomUUID(),
      content: draft.content,
      createdAt: new Date().toISOString(),
      note,
    };

    await db.drafts.update(id, {
      versions: [...draft.versions, version],
      updatedAt: new Date().toISOString(),
    });
    await get().fetchDrafts();
    if (get().selectedDraft?.id === id) {
      const updated = await db.drafts.get(id);
      if (updated) set({ selectedDraft: updated });
    }
  },

  setSelectedDraft: (draft) => {
    set({ selectedDraft: draft });
  },

  calculateWordCount: (content: string) => {
    // Remove HTML tags if present, then count words
    const text = content.replace(/<[^>]*>/g, ' ').trim();
    return text ? text.split(/\s+/).filter((word) => word.length > 0).length : 0;
  },
}));
