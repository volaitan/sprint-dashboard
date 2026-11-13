import { lazy, Suspense, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ApiContext, useApi } from './api/client';
import type { Api } from './api/types';
import { ToastProvider } from './components/Toast';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { TeamsPage } from './pages/TeamsPage';
// The team page carries the charting and drag-and-drop libraries, so load it on demand.
const TeamPage = lazy(() => import('./pages/TeamPage').then((m) => ({ default: m.TeamPage })));

function RequireAuth({ children }: { children: ReactNode }) {
  const api = useApi();
  const location = useLocation();
  if (!api.isLoggedIn()) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

// HashRouter keeps deep links working on static hosts such as GitHub Pages.
export function App({ api, queryClient }: { api: Api; queryClient?: QueryClient }) {
  const [client] = useState(
    () => queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );
  return (
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <HashRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<RequireAuth><Layout /></RequireAuth>}>
                <Route path="/" element={<TeamsPage />} />
                <Route path="/teams/:teamId" element={<Suspense fallback={<p className="muted">Loading…</p>}><TeamPage /></Suspense>} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </HashRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ApiContext.Provider>
  );
}
