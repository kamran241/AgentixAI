import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import BusinessDetail from './pages/BusinessDetail';
import Bookings from './pages/Bookings';
import ChatPage from './pages/ChatPage';
import WidgetChat from './pages/WidgetChat';
import Privacy from './pages/Privacy';

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
      <Route path="/dashboard" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />
      <Route path="/business/:id" element={
        <ProtectedRoute><BusinessDetail /></ProtectedRoute>
      } />
      <Route path="/bookings" element={
        <ProtectedRoute><Bookings /></ProtectedRoute>
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
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
