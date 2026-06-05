import { create } from 'zustand';
import { db, initializeDatabase } from '../utils/db';
import type { InterviewRequest } from '../types';

interface InterviewRequestsState {
  requests: InterviewRequest[];
  isLoading: boolean;
  fetchRequests: () => Promise<void>;
  createRequest: (request: Omit<InterviewRequest, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateRequest: (id: string, updates: Partial<InterviewRequest>) => Promise<void>;
  deleteRequest: (id: string) => Promise<void>;
  getRequest: (id: string) => Promise<InterviewRequest | undefined>;
}

export const useInterviewRequestsStore = create<InterviewRequestsState>((set, get) => ({
  requests: [],
  isLoading: false,

  fetchRequests: async () => {
    set({ isLoading: true });
    try {
      // Ensure database is initialized
      await initializeDatabase();
      const requests = await db.interviewRequests.orderBy('createdAt').reverse().toArray();
      set({ requests, isLoading: false });
    } catch (error: any) {
      console.error('Failed to fetch interview requests:', error);
      
      // If it's a schema error, provide helpful message
      if (error.name === 'VersionError' || error.name === 'ConstraintError' || error.message?.includes('index')) {
        console.error('Database schema error detected. Please reset the database.');
      }
      
      set({ isLoading: false });
    }
  },

  createRequest: async (requestData) => {
    try {
      // Ensure database is initialized
      await initializeDatabase();
      
      const now = new Date().toISOString();
      const request: InterviewRequest = {
        ...requestData,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      };

      await db.interviewRequests.add(request);
      await get().fetchRequests();
      return request.id;
    } catch (error: any) {
      console.error('Error creating interview request:', error);
      
      // If it's a constraint error, provide clear instructions
      if (error.name === 'ConstraintError' || 
          error.name === 'VersionError' ||
          error.message?.includes('index') || 
          error.message?.includes('already exists') ||
          error.message?.includes('ConstraintError') ||
          error.message?.includes('Database schema error')) {
        throw new Error('Database schema error. Please go to Settings → Database → Reset Database to fix this issue. If reset doesn\'t work, try manually deleting the database in browser DevTools (F12 → Application → IndexedDB → ResearchDatabase → Delete).');
      }
      
      throw error;
    }
  },

  updateRequest: async (id, updates) => {
    const updatesWithTimestamp = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await db.interviewRequests.update(id, updatesWithTimestamp);
    await get().fetchRequests();
  },

  deleteRequest: async (id) => {
    await db.interviewRequests.delete(id);
    await get().fetchRequests();
  },

  getRequest: async (id) => {
    return await db.interviewRequests.get(id);
  },
}));
