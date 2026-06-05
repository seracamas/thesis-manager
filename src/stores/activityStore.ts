import { create } from 'zustand';
import { db } from '../utils/db';
import type { ActivityItem } from '../types';

interface ActivityState {
  activities: ActivityItem[];
  isLoading: boolean;
  fetchActivities: (limit?: number) => Promise<void>;
  addActivity: (activity: Omit<ActivityItem, 'id' | 'timestamp'>) => Promise<void>;
  clearActivities: () => Promise<void>;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  activities: [],
  isLoading: false,

  fetchActivities: async (limit = 50) => {
    set({ isLoading: true });
    try {
      const activities = await db.activity
        .orderBy('timestamp')
        .reverse()
        .limit(limit)
        .toArray();
      set({ activities, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch activities:', error);
      set({ isLoading: false });
    }
  },

  addActivity: async (activityData) => {
    const activity: ActivityItem = {
      ...activityData,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    await db.activity.add(activity);
    // Keep only last 1000 activities
    const count = await db.activity.count();
    if (count > 1000) {
      const oldest = await db.activity.orderBy('timestamp').first();
      if (oldest) {
        await db.activity.delete(oldest.id);
      }
    }
    await get().fetchActivities();
  },

  clearActivities: async () => {
    await db.activity.clear();
    await get().fetchActivities();
  },
}));
