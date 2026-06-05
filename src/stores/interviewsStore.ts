import { create } from 'zustand';
import { db } from '../utils/db';
import type { Interview, InterviewHighlight } from '../types';
import { autosaveManager } from '../utils/autosave';

interface InterviewsState {
  interviews: Interview[];
  isLoading: boolean;
  selectedInterview: Interview | null;
  fetchInterviews: () => Promise<void>;
  getInterview: (id: string) => Promise<Interview | undefined>;
  createInterview: (interview: Omit<Interview, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateInterview: (id: string, updates: Partial<Interview>) => Promise<void>;
  deleteInterview: (id: string) => Promise<void>;
  searchInterviews: (query: string) => Promise<Interview[]>;
  addHighlight: (interviewId: string, highlight: InterviewHighlight) => Promise<void>;
  updateHighlight: (interviewId: string, highlightId: string, updates: Partial<InterviewHighlight>) => Promise<void>;
  removeHighlight: (interviewId: string, highlightId: string) => Promise<void>;
  setSelectedInterview: (interview: Interview | null) => void;
}

export const useInterviewsStore = create<InterviewsState>((set, get) => ({
  interviews: [],
  isLoading: false,
  selectedInterview: null,

  fetchInterviews: async () => {
    set({ isLoading: true });
    try {
      const interviews = await db.interviews.orderBy('updatedAt').reverse().toArray();
      set({ interviews, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch interviews:', error);
      set({ isLoading: false });
    }
  },

  getInterview: async (id: string) => {
    return await db.interviews.get(id);
  },

  createInterview: async (interviewData) => {
    const now = new Date().toISOString();
    const interview: Interview = {
      ...interviewData,
      id: crypto.randomUUID(),
      highlights: interviewData.highlights || [],
      createdAt: now,
      updatedAt: now,
    };

    await db.interviews.add(interview);
    await get().fetchInterviews();
    return interview.id;
  },

  updateInterview: async (id, updates) => {
    const updatesWithTimestamp = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    autosaveManager.trigger(`interview-${id}`);
    autosaveManager.register(`interview-${id}`, async () => {
      await db.interviews.update(id, updatesWithTimestamp);
      await get().fetchInterviews();
      if (get().selectedInterview?.id === id) {
        const updated = await db.interviews.get(id);
        if (updated) set({ selectedInterview: updated });
      }
    });
  },

  deleteInterview: async (id) => {
    await db.interviews.delete(id);
    await get().fetchInterviews();
    if (get().selectedInterview?.id === id) {
      set({ selectedInterview: null });
    }
  },

  searchInterviews: async (query) => {
    const lowerQuery = query.toLowerCase();
    return await db.interviews
      .filter((interview) => {
        return (
          interview.interviewee.toLowerCase().includes(lowerQuery) ||
          interview.transcript.toLowerCase().includes(lowerQuery) ||
          interview.location?.toLowerCase().includes(lowerQuery) ||
          interview.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
        );
      })
      .toArray();
  },

  addHighlight: async (interviewId, highlight) => {
    const interview = await db.interviews.get(interviewId);
    if (interview) {
      await db.interviews.update(interviewId, {
        highlights: [...interview.highlights, highlight],
        updatedAt: new Date().toISOString(),
      });
      await get().fetchInterviews();
      if (get().selectedInterview?.id === interviewId) {
        const updated = await db.interviews.get(interviewId);
        if (updated) set({ selectedInterview: updated });
      }
    }
  },

  updateHighlight: async (interviewId, highlightId, updates) => {
    const interview = await db.interviews.get(interviewId);
    if (interview) {
      const highlights = interview.highlights.map((h) =>
        h.id === highlightId ? { ...h, ...updates } : h
      );
      await db.interviews.update(interviewId, {
        highlights,
        updatedAt: new Date().toISOString(),
      });
      await get().fetchInterviews();
      if (get().selectedInterview?.id === interviewId) {
        const updated = await db.interviews.get(interviewId);
        if (updated) set({ selectedInterview: updated });
      }
    }
  },

  removeHighlight: async (interviewId, highlightId) => {
    const interview = await db.interviews.get(interviewId);
    if (interview) {
      await db.interviews.update(interviewId, {
        highlights: interview.highlights.filter((h) => h.id !== highlightId),
        updatedAt: new Date().toISOString(),
      });
      await get().fetchInterviews();
      if (get().selectedInterview?.id === interviewId) {
        const updated = await db.interviews.get(interviewId);
        if (updated) set({ selectedInterview: updated });
      }
    }
  },

  setSelectedInterview: (interview) => {
    set({ selectedInterview: interview });
  },
}));
