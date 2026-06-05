import { create } from 'zustand';
import { db } from '../utils/db';
import type { DataFile } from '../types';

interface DataFilesState {
  dataFiles: DataFile[];
  isLoading: boolean;
  selectedFile: DataFile | null;
  fetchDataFiles: () => Promise<void>;
  getDataFile: (id: string) => Promise<DataFile | undefined>;
  createDataFile: (file: Omit<DataFile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateDataFile: (id: string, updates: Partial<DataFile>) => Promise<void>;
  deleteDataFile: (id: string) => Promise<void>;
  searchDataFiles: (query: string) => Promise<DataFile[]>;
  getFilesByFolder: (folder: string) => Promise<DataFile[]>;
  setSelectedFile: (file: DataFile | null) => void;
}

export const useDataFilesStore = create<DataFilesState>((set, get) => ({
  dataFiles: [],
  isLoading: false,
  selectedFile: null,

  fetchDataFiles: async () => {
    set({ isLoading: true });
    try {
      const files = await db.dataFiles.orderBy('updatedAt').reverse().toArray();
      set({ dataFiles: files, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch data files:', error);
      set({ isLoading: false });
    }
  },

  getDataFile: async (id: string) => {
    return await db.dataFiles.get(id);
  },

  createDataFile: async (fileData) => {
    const now = new Date().toISOString();
    const file: DataFile = {
      ...fileData,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    await db.dataFiles.add(file);
    await get().fetchDataFiles();
    return file.id;
  },

  updateDataFile: async (id, updates) => {
    const updatesWithTimestamp = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await db.dataFiles.update(id, updatesWithTimestamp);
    await get().fetchDataFiles();
    if (get().selectedFile?.id === id) {
      const updated = await db.dataFiles.get(id);
      if (updated) set({ selectedFile: updated });
    }
  },

  deleteDataFile: async (id) => {
    await db.dataFiles.delete(id);
    await get().fetchDataFiles();
    if (get().selectedFile?.id === id) {
      set({ selectedFile: null });
    }
  },

  searchDataFiles: async (query) => {
    const lowerQuery = query.toLowerCase();
    return await db.dataFiles
      .filter((file) => {
        return (
          file.name.toLowerCase().includes(lowerQuery) ||
          file.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
          JSON.stringify(file.metadata).toLowerCase().includes(lowerQuery)
        );
      })
      .toArray();
  },

  getFilesByFolder: async (folder: string) => {
    return await db.dataFiles.where('folder').equals(folder).toArray();
  },

  setSelectedFile: (file) => {
    set({ selectedFile: file });
  },
}));
