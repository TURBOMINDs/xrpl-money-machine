import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await authApi.me();
      setMe(data);
      setUser(data.user);
      return data;
    } catch (e) {
      setUser(null);
      setMe(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const setToken = (token) => {
    if (token) {
      localStorage.setItem('umm_token', token);
    } else {
      localStorage.removeItem('umm_token');
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      // ignore
    }
    setToken(null);
    setUser(null);
    setMe(null);
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthCtx.Provider value={{ user, me, loading, refresh, setToken, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
