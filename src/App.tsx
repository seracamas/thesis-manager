import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { Layout } from './components/layout/Layout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ToastContainer } from './components/ui/ToastContainer';
import { SkeletonList } from './components/ui/Skeleton';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { useUIStore } from './stores/uiStore';
import { useGlobalShortcuts } from './hooks/useKeyboardShortcuts';
import { useEffect } from 'react';

// Lazy load pages for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Sources = lazy(() => import('./pages/Sources').then(m => ({ default: m.Sources })));
const Interviews = lazy(() => import('./pages/Interviews').then(m => ({ default: m.Interviews })));
const Data = lazy(() => import('./pages/Data').then(m => ({ default: m.Data })));
const Drafts = lazy(() => import('./pages/Drafts').then(m => ({ default: m.Drafts })));
const DraftDetail = lazy(() => import('./pages/DraftDetail').then(m => ({ default: m.DraftDetail })));
const SharedDraft = lazy(() => import('./pages/SharedDraft').then(m => ({ default: m.SharedDraft })));
const Themes = lazy(() => import('./pages/Themes').then(m => ({ default: m.Themes })));
const Discover = lazy(() => import('./pages/Discover').then(m => ({ default: m.Discover })));
const Planning = lazy(() => import('./pages/Planning').then(m => ({ default: m.Planning })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  useGlobalShortcuts();

  useEffect(() => {
    // Warm, light theme - remove dark mode class
    document.documentElement.classList.remove('dark');
  }, []);

  return (
    <ProtectedRoute>
      <Layout>
        <Suspense fallback={<SkeletonList count={5} />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/interviews" element={<Interviews />} />
            <Route path="/data" element={<Data />} />
            <Route path="/drafts" element={<Drafts />} />
            <Route path="/drafts/:id" element={<DraftDetail />} />
            <Route path="/shared/:shareLink" element={<SharedDraft />} />
            <Route path="/themes" element={<Themes />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/planning" element={<Planning />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Suspense>
        <ToastContainer />
      </Layout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
