import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import BusinessDetail from './pages/BusinessDetail';
import Bookings from './pages/Bookings';
import Settings from './pages/Settings';
import ChatPage from './pages/ChatPage';
import WidgetChat from './pages/WidgetChat';
import Privacy from './pages/Privacy';
import Contact from './pages/Contact';

function RootRedirect() {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : <Landing />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/widget-chat" element={<WidgetChat />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/dashboard" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />
      <Route path="/business/:id" element={
        <ProtectedRoute><BusinessDetail /></ProtectedRoute>
      } />
      <Route path="/bookings" element={
        <ProtectedRoute><Bookings /></ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute><Settings /></ProtectedRoute>
      } />
      <Route path="/chat" element={
        <ProtectedRoute><ChatPage /></ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                fontSize: '0.875rem',
              },
              success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
