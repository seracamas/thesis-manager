# Thesis Research Management Web Application

A comprehensive research management system for academic research, built with React, TypeScript, and modern web technologies.

## Features

- **Dashboard**: Overview of your research with stats and recent activity
- **Source Management**: Organize and cite research sources
- **Literature Notes**: Rich text notes linked to sources
- **Interview Transcripts**: Manage and code interview data
- **Study Results & Data**: Organize research data files
- **Research Journal**: Daily research journal entries
- **Writing Drafts**: Document management with version control
- **Theme Tracker**: Track and analyze research themes
- **Global Search**: Search across all research materials

## Tech Stack

- React 18 + TypeScript
- Vite for build tooling
- TailwindCSS for styling
- Zustand for state management
- React Router for navigation
- IndexedDB via Dexie.js for data storage
- React Query for data fetching/caching
- Tiptap for rich text editing

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
src/
├── components/
│   ├── layout/       # Layout components (Sidebar, TopBar, Layout)
│   ├── ui/           # Reusable UI components (Button, Input, Card, etc.)
│   ├── sources/      # Source management components
│   ├── notes/        # Note components
│   ├── interviews/   # Interview components
│   ├── data/         # Data file components
│   ├── journal/      # Journal components
│   ├── drafts/       # Draft components
│   ├── themes/       # Theme components
│   ├── search/       # Search components
│   └── dashboard/    # Dashboard components
├── hooks/            # Custom React hooks
├── stores/           # Zustand state stores
├── utils/            # Utility functions
├── types/            # TypeScript type definitions
└── App.tsx           # Main app component
```

## Color Scheme

The application uses a custom academic color palette:

- **Primary**: Navy (#1e3a8a)
- **Secondary**: Forest Green (#065f46)
- **Accent**: Amber (#f59e0b)
- **Neutrals**: Warm grays

Dark mode is fully supported and can be toggled from the top bar.

## Development

This project uses:
- ESLint for code linting
- TypeScript for type safety
- TailwindCSS for styling

Run the linter:
```bash
npm run lint
```

## Features

### Phase 1-3: Core Functionality ✅
- Complete data layer with IndexedDB
- 9 core modules (Dashboard, Sources, Notes, Interviews, Data, Journal, Drafts, Themes, Search)
- Rich text editing with Tiptap
- Full CRUD operations
- Search across all content types
- Tag management
- Activity tracking

### Phase 4: UX Enhancements ✅
- **Keyboard Shortcuts**: 
  - `⌘K` (Cmd+K) - Open search
  - `⌘N` (Cmd+N) - Create new note (context-aware)
- **Toast Notifications**: Success, error, info, and warning toasts
- **Loading States**: Skeleton loaders for better perceived performance
- **Empty States**: Helpful CTAs when no data exists
- **Autosave Indicators**: Visual feedback for save status
- **Error Boundaries**: Graceful error handling

### Phase 5: Polish & Deployment ✅
- **Accessibility**: ARIA labels, keyboard navigation, focus management
- **Code Splitting**: Lazy-loaded routes for optimal performance
- **Responsive Design**: Works on desktop, tablet, and mobile
- **PWA Ready**: Manifest file for Progressive Web App support
- **Deployment Configs**: Vercel and Netlify configurations included

## Keyboard Shortcuts

- `⌘K` / `Ctrl+K` - Open global search
- `⌘N` / `Ctrl+N` - Create new item (context-aware)
- `Esc` - Close modals
- `Tab` - Navigate between interactive elements

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Project Structure

```
src/
├── components/
│   ├── layout/       # Layout components
│   ├── ui/           # Reusable UI components
│   ├── editor/       # Rich text editor
│   └── [module]/     # Module-specific components
├── hooks/            # Custom React hooks
├── stores/           # Zustand state stores
├── utils/            # Utility functions
├── types/            # TypeScript definitions
└── pages/            # Page components
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

Quick deploy to Vercel:
```bash
npm run build
vercel --prod
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## Performance

- Code splitting for optimal bundle sizes
- Lazy loading of routes
- IndexedDB for fast local storage
- Optimized builds with tree shaking

## License

Private project for academic research use.
