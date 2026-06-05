import { create } from 'zustand';
import { db } from '../utils/db';
import type { Note } from '../types';
import { autosaveManager } from '../utils/autosave';

interface NotesState {
  notes: Note[];
  isLoading: boolean;
  selectedNote: Note | null;
  fetchNotes: () => Promise<void>;
  getNote: (id: string) => Promise<Note | undefined>;
  createNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  searchNotes: (query: string) => Promise<Note[]>;
  linkNotes: (noteId: string, linkedNoteId: string) => Promise<void>;
  unlinkNotes: (noteId: string, linkedNoteId: string) => Promise<void>;
  setSelectedNote: (note: Note | null) => void;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  isLoading: false,
  selectedNote: null,

  fetchNotes: async () => {
    set({ isLoading: true });
    try {
      const notes = await db.notes.orderBy('updatedAt').reverse().toArray();
      set({ notes, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch notes:', error);
      set({ isLoading: false });
    }
  },

  getNote: async (id: string) => {
    return await db.notes.get(id);
  },

  createNote: async (noteData) => {
    const now = new Date().toISOString();
    const note: Note = {
      ...noteData,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    await db.notes.add(note);
    await get().fetchNotes();
    return note.id;
  },

  updateNote: async (id, updates) => {
    const updatesWithTimestamp = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    autosaveManager.trigger(`note-${id}`);
    autosaveManager.register(`note-${id}`, async () => {
      await db.notes.update(id, updatesWithTimestamp);
      await get().fetchNotes();
      if (get().selectedNote?.id === id) {
        const updated = await db.notes.get(id);
        if (updated) set({ selectedNote: updated });
      }
    });
  },

  deleteNote: async (id) => {
    // Remove links from other notes
    const notes = await db.notes.toArray();
    for (const note of notes) {
      if (note.linkedNoteIds.includes(id)) {
        await db.notes.update(note.id, {
          linkedNoteIds: note.linkedNoteIds.filter((linkedId) => linkedId !== id),
        });
      }
    }

    await db.notes.delete(id);
    await get().fetchNotes();
    if (get().selectedNote?.id === id) {
      set({ selectedNote: null });
    }
  },

  searchNotes: async (query) => {
    const lowerQuery = query.toLowerCase();
    return await db.notes
      .filter((note) => {
        return (
          note.title.toLowerCase().includes(lowerQuery) ||
          note.content.toLowerCase().includes(lowerQuery) ||
          note.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
        );
      })
      .toArray();
  },

  linkNotes: async (noteId, linkedNoteId) => {
    const note = await db.notes.get(noteId);
    if (note && !note.linkedNoteIds.includes(linkedNoteId)) {
      await db.notes.update(noteId, {
        linkedNoteIds: [...note.linkedNoteIds, linkedNoteId],
        updatedAt: new Date().toISOString(),
      });
      await get().fetchNotes();
    }
  },

  unlinkNotes: async (noteId, linkedNoteId) => {
    const note = await db.notes.get(noteId);
    if (note) {
      await db.notes.update(noteId, {
        linkedNoteIds: note.linkedNoteIds.filter((id) => id !== linkedNoteId),
        updatedAt: new Date().toISOString(),
      });
      await get().fetchNotes();
    }
  },

  setSelectedNote: (note) => {
    set({ selectedNote: note });
  },
}));
