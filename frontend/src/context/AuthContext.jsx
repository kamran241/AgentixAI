import { createContext, useContext, useState, useCallback } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('agentix_user'));
    } catch {
      return null;
    }
  });

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('agentix_token', data.access_token);
    const me = await api.get('/auth/me');
    localStorage.setItem('agentix_user', JSON.stringify(me.data));
    setUser(me.data);
    return me.data;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('agentix_token', data.access_token);
    const me = await api.get('/auth/me');
    localStorage.setItem('agentix_user', JSON.stringify(me.data));
    setUser(me.data);
    return me.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('agentix_token');
    localStorage.removeItem('agentix_user');
    setUser(null);
  }, []);

  const updateUser = useCallback((updated) => {
    localStorage.setItem('agentix_user', JSON.stringify(updated));
    setUser(updated);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
