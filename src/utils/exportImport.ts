import { db } from './db';
import type {
  Source,
  Note,
  Interview,
  DataFile,
  JournalEntry,
  Draft,
  Theme,
  ActivityItem,
} from '../types';

export interface BackupData {
  version: string;
  exportDate: string;
  sources: Source[];
  notes: Note[];
  interviews: Interview[];
  dataFiles: DataFile[];
  journalEntries: JournalEntry[];
  drafts: Draft[];
  themes: Theme[];
  activity: ActivityItem[];
}

const BACKUP_VERSION = '1.0.0';

export async function exportToJSON(): Promise<string> {
  const [sources, notes, interviews, dataFiles, journalEntries, drafts, themes, activity] =
    await Promise.all([
      db.sources.toArray(),
      db.notes.toArray(),
      db.interviews.toArray(),
      db.dataFiles.toArray(),
      db.journalEntries.toArray(),
      db.drafts.toArray(),
      db.themes.toArray(),
      db.activity.toArray(),
    ]);

  const backup: BackupData = {
    version: BACKUP_VERSION,
    exportDate: new Date().toISOString(),
    sources,
    notes,
    interviews,
    dataFiles,
    journalEntries,
    drafts,
    themes,
    activity,
  };

  return JSON.stringify(backup, null, 2);
}

export async function exportToFile(): Promise<void> {
  const json = await exportToJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `thesis-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importFromJSON(json: string): Promise<{
  success: boolean;
  errors: string[];
  counts: Record<string, number>;
}> {
  const errors: string[] = [];
  const counts: Record<string, number> = {};

  try {
    const backup: BackupData = JSON.parse(json);

    // Validate version (for future compatibility)
    if (backup.version !== BACKUP_VERSION) {
      errors.push(`Version mismatch: expected ${BACKUP_VERSION}, got ${backup.version}`);
    }

    // Import in transaction for atomicity
    await db.transaction('rw', [db.sources, db.notes, db.interviews, db.dataFiles, db.journalEntries, db.drafts, db.themes, db.activity], async () => {
      // Clear existing data (optional - could also merge)
      await Promise.all([
        db.sources.clear(),
        db.notes.clear(),
        db.interviews.clear(),
        db.dataFiles.clear(),
        db.journalEntries.clear(),
        db.drafts.clear(),
        db.themes.clear(),
        db.activity.clear(),
      ]);

      // Import data
      try {
        if (backup.sources?.length) {
          await db.sources.bulkAdd(backup.sources);
          counts.sources = backup.sources.length;
        }
      } catch (e) {
        errors.push(`Failed to import sources: ${e}`);
      }

      try {
        if (backup.notes?.length) {
          await db.notes.bulkAdd(backup.notes);
          counts.notes = backup.notes.length;
        }
      } catch (e) {
        errors.push(`Failed to import notes: ${e}`);
      }

      try {
        if (backup.interviews?.length) {
          await db.interviews.bulkAdd(backup.interviews);
          counts.interviews = backup.interviews.length;
        }
      } catch (e) {
        errors.push(`Failed to import interviews: ${e}`);
      }

      try {
        if (backup.dataFiles?.length) {
          await db.dataFiles.bulkAdd(backup.dataFiles);
          counts.dataFiles = backup.dataFiles.length;
        }
      } catch (e) {
        errors.push(`Failed to import data files: ${e}`);
      }

      try {
        if (backup.journalEntries?.length) {
          await db.journalEntries.bulkAdd(backup.journalEntries);
          counts.journalEntries = backup.journalEntries.length;
        }
      } catch (e) {
        errors.push(`Failed to import journal entries: ${e}`);
      }

      try {
        if (backup.drafts?.length) {
          await db.drafts.bulkAdd(backup.drafts);
          counts.drafts = backup.drafts.length;
        }
      } catch (e) {
        errors.push(`Failed to import drafts: ${e}`);
      }

      try {
        if (backup.themes?.length) {
          await db.themes.bulkAdd(backup.themes);
          counts.themes = backup.themes.length;
        }
      } catch (e) {
        errors.push(`Failed to import themes: ${e}`);
      }

      try {
        if (backup.activity?.length) {
          await db.activity.bulkAdd(backup.activity);
          counts.activity = backup.activity.length;
        }
      } catch (e) {
        errors.push(`Failed to import activity: ${e}`);
      }
    });

    return {
      success: errors.length === 0,
      errors,
      counts,
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Failed to parse JSON: ${error}`],
      counts: {},
    };
  }
}

export async function importFromFile(file: File): Promise<{
  success: boolean;
  errors: string[];
  counts: Record<string, number>;
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const result = await importFromJSON(text);
      resolve(result);
    };
    reader.onerror = () => {
      resolve({
        success: false,
        errors: ['Failed to read file'],
        counts: {},
      });
    };
    reader.readAsText(file);
  });
}
