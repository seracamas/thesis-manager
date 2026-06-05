import { useState, useEffect } from 'react';
import { liveQuery } from 'dexie';
import { db, type Source } from '../utils/db';

/**
 * Hook to get sources with real-time updates using Dexie's liveQuery
 * Automatically syncs with IndexedDB changes reactively
 */
export function useSources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Create a live query that observes changes to the sources table
    // Note: new schema uses createdAt instead of updatedAt
    const observable = liveQuery(() => 
      db.sources.orderBy('createdAt').reverse().toArray()
    );

    // Subscribe to the observable
    const subscription = observable.subscribe({
      next: (result) => {
        setSources(result || []);
        setIsLoading(false);
      },
      error: (error) => {
        console.error('Error in live query:', error);
        setIsLoading(false);
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { 
    sources, 
    isLoading,
    fetchSources: async () => {
      // No-op - liveQuery handles fetching automatically
    }
  };
}

/**
 * Check if a source with the same DOI or URL already exists
 * Returns the duplicate source if found, null otherwise
 */
export async function checkDuplicateSource(doi?: string, url?: string, title?: string): Promise<Source | null> {
  if (!doi && !url && !title) {
    return null;
  }

  try {
    const sources = await db.sources.toArray();
    
    // Check by DOI first (most reliable)
    if (doi) {
      const byDoi = sources.find(s => s.doi?.toLowerCase() === doi.toLowerCase());
      if (byDoi) return byDoi;
    }

    // Check by URL
    if (url) {
      const byUrl = sources.find(s => s.url?.toLowerCase() === url.toLowerCase());
      if (byUrl) return byUrl;
    }

    // Check by title (fuzzy match)
    if (title) {
      const normalizedTitle = title.toLowerCase().trim();
      const byTitle = sources.find(s => 
        s.title.toLowerCase().trim() === normalizedTitle
      );
      if (byTitle) return byTitle;
    }

    return null;
  } catch (error) {
    console.error('Error checking for duplicate source:', error);
    return null;
  }
}
