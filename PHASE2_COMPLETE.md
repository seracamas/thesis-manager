# Phase 2: State Management & Data Layer - Complete ✅

## What Was Implemented

### 1. IndexedDB Database Schema (Dexie.js)
- **Location**: `src/utils/db.ts`
- **Database**: `ResearchDatabase` class extending Dexie
- **Tables Created**:
  - `sources` - Research sources with indexes on title, authors, date, type, tags
  - `notes` - Literature notes with indexes on title, sourceId, linkedNoteIds, tags
  - `interviews` - Interview transcripts with indexes on interviewee, date, type, tags
  - `dataFiles` - Data files with indexes on name, type, folder, tags
  - `journalEntries` - Journal entries with indexes on date, tags
  - `drafts` - Writing drafts with indexes on title, parentId, status
  - `themes` - Research themes with indexes on name
  - `activity` - Activity log with compound index on [type+timestamp]

- **Search Indexes**: All tables have appropriate indexes for fast searching
- **Multi-entry Indexes**: Tags and linkedNoteIds use multi-entry indexes for efficient filtering

### 2. Zustand State Stores
All stores follow a consistent pattern with CRUD operations and search capabilities:

#### Sources Store (`src/stores/sourcesStore.ts`)
- Fetch all sources (ordered by updatedAt)
- Get single source by ID
- Create, update, delete sources
- Search sources by title, authors, citation, notes, tags
- Selected source state management
- Autosave integration

#### Notes Store (`src/stores/notesStore.ts`)
- Fetch all notes (ordered by updatedAt)
- Get single note by ID
- Create, update, delete notes
- Search notes by title, content, tags
- Bi-directional linking (linkNotes, unlinkNotes)
- Automatic cleanup of links when notes are deleted
- Selected note state management
- Autosave integration

#### Interviews Store (`src/stores/interviewsStore.ts`)
- Fetch all interviews (ordered by updatedAt)
- Get single interview by ID
- Create, update, delete interviews
- Search interviews by interviewee, transcript, location, tags
- Highlight management (add, update, remove highlights)
- Selected interview state management
- Autosave integration

#### Data Files Store (`src/stores/dataStore.ts`)
- Fetch all data files (ordered by updatedAt)
- Get single file by ID
- Create, update, delete files
- Search files by name, tags, metadata
- Get files by folder
- Selected file state management

#### Journal Store (`src/stores/journalStore.ts`)
- Fetch all entries (ordered by date)
- Get entry by ID or by date
- Create, update, delete entries
- Search entries by content, tags
- Get entries by date range
- Selected entry state management
- Autosave integration

#### Drafts Store (`src/stores/draftsStore.ts`)
- Fetch all drafts (ordered by updatedAt)
- Get single draft by ID
- Get drafts by parent (for hierarchical structure)
- Create, update, delete drafts
- Search drafts by title, content
- Version history management (saveVersion)
- Automatic word count calculation
- Cascade delete for child drafts
- Selected draft state management
- Autosave integration

#### Themes Store (`src/stores/themesStore.ts`)
- Fetch all themes (ordered by updatedAt)
- Get single theme by ID
- Create, update, delete themes
- Search themes by name, description, memo
- Selected theme state management
- Autosave integration

#### Activity Store (`src/stores/activityStore.ts`)
- Fetch recent activities (with limit)
- Add activity items
- Clear all activities
- Automatic cleanup (keeps only last 1000 activities)

#### UI Store (`src/stores/uiStore.ts`) - Already existed from Phase 1
- Dark mode state
- Sidebar collapse state
- Persistent storage

### 3. Autosave Debouncing Utility
- **Location**: `src/utils/autosave.ts`
- **Features**:
  - Debounced saves (default 1 second delay)
  - Max wait time (default 5 seconds) to ensure saves happen even during rapid typing
  - Per-item autosave management
  - Flush capability for immediate saves
  - Error handling

- **React Hook**: `src/hooks/useAutosave.ts`
  - Custom hook for easy integration in components
  - Automatic cleanup on unmount
  - Stable callback references

- **Integration**: All text-editing stores (sources, notes, interviews, journal, drafts, themes) use autosave

### 4. Export/Import Functions
- **Location**: `src/utils/exportImport.ts`
- **Features**:
  - `exportToJSON()` - Export all data to JSON string
  - `exportToFile()` - Download backup as JSON file with date stamp
  - `importFromJSON()` - Import from JSON string with validation
  - `importFromFile()` - Import from uploaded file
  - Transaction-based imports for atomicity
  - Error reporting with detailed counts
  - Version checking for future compatibility

- **Backup Format**: Structured JSON with version and export date
- **Data Included**: All tables (sources, notes, interviews, dataFiles, journalEntries, drafts, themes, activity)

## Store Patterns

All stores follow these patterns:
1. **State**: `items`, `isLoading`, `selectedItem`
2. **CRUD Operations**: `fetchItems()`, `getItem(id)`, `createItem()`, `updateItem()`, `deleteItem()`
3. **Search**: `searchItems(query)` with full-text search across relevant fields
4. **Selection**: `setSelectedItem()` for managing currently viewed item
5. **Autosave**: Integrated for text-heavy stores
6. **Activity Tracking**: Stores can trigger activity log entries (to be integrated in Phase 3)

## Database Features

- **IndexedDB**: Client-side database for offline-first functionality
- **Dexie.js**: Clean API wrapper around IndexedDB
- **Indexes**: Optimized for common queries (search, filtering, sorting)
- **Multi-entry Indexes**: For array fields like tags
- **Transactions**: Used for atomic operations (imports)

## Updated Components

- **Dashboard**: Now uses stores to display real counts and recent activity
- **Stores Index**: Central export file for easy imports

## Next Steps (Phase 3)

Phase 2 provides the complete data layer. Phase 3 will build the UI components on top of these stores:
- Source management forms and lists
- Rich text editors for notes
- Interview transcript viewers
- Data file uploaders
- Journal calendar view
- Draft editor with version history
- Theme management UI
- Global search interface

## Usage Examples

### Using a Store
```typescript
import { useSourcesStore } from '../stores';

function MyComponent() {
  const { sources, fetchSources, createSource } = useSourcesStore();
  
  useEffect(() => {
    fetchSources();
  }, []);
  
  const handleCreate = async () => {
    await createSource({
      title: 'New Source',
      authors: ['Author Name'],
      date: '2024-01-01',
      type: 'article',
      citation: '...',
      tags: [],
    });
  };
}
```

### Using Autosave
```typescript
import { useAutosave } from '../hooks/useAutosave';

function Editor({ id, content }) {
  const { updateNote } = useNotesStore();
  
  useAutosave(`note-${id}`, async () => {
    await updateNote(id, { content });
  }, [content]);
  
  // Changes to content will auto-save after 1 second
}
```

### Export/Import
```typescript
import { exportToFile, importFromFile } from '../utils/exportImport';

// Export
await exportToFile();

// Import
const file = // file input
const result = await importFromFile(file);
if (result.success) {
  console.log('Imported:', result.counts);
} else {
  console.error('Errors:', result.errors);
}
```
