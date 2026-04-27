import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/lib/auth';
import Landing from '@/pages/Landing';
import Dashboard from '@/pages/Dashboard';
import PairDetail from '@/pages/PairDetail';
import AlertsPage from '@/pages/AlertsPage';
import Settings from '@/pages/Settings';
import Subscribe from '@/pages/Subscribe';
import Terms from '@/pages/Terms';
import Privacy from '@/pages/Privacy';
import '@/App.css';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="font-display text-xl text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/" element={loading ? <Landing /> : user ? <Navigate to="/dashboard" replace /> : <Landing />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/pair/:id" element={<Protected><PairDetail /></Protected>} />
      <Route path="/alerts" element={<Protected><AlertsPage /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="/subscribe" element={<Protected><Subscribe /></Protected>} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App bg-background min-h-screen text-foreground">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster theme="dark" richColors position="bottom-right" />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
