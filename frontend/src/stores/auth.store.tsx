import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User } from '../types';
import { setAccessToken } from '../services/api';
import * as authService from '../services/auth.service';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: authService.RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

let inFlightRefresh: Promise<User | null> | null = null;

async function performSessionRefresh(): Promise<User | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      try {
        const { data } = await authService.refreshToken();
        setAccessToken(data.accessToken);
        const userRes = await authService.getCurrentUser();
        return userRes.data;
      } catch {
        setAccessToken(null);
        return null;
      } finally {
        inFlightRefresh = null;
      }
    })();
  }
  return inFlightRefresh;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    const restoredUser = await performSessionRefresh();
    setUser(restoredUser);
  }, []);

  useEffect(() => {
    let active = true;
    performSessionRefresh().then((restoredUser) => {
      if (active) {
        setUser(restoredUser);
        setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const { data } = await authService.login({ email, password });
    setAccessToken(data.accessToken);
    if (data.user) {
      setUser(data.user);
      return data.user;
    }
    const userRes = await authService.getCurrentUser();
    setUser(userRes.data);
    return userRes.data;
  }, []);

  const register = useCallback(
    async (payload: authService.RegisterPayload): Promise<User> => {
      const { data } = await authService.register(payload);
      if (data?.accessToken) {
        setAccessToken(data.accessToken);
      }
      if (data?.user) {
        setUser(data.user);
        return data.user;
      }
      const userRes = await authService.getCurrentUser();
      setUser(userRes.data);
      return userRes.data;
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'ADMIN',
        login,
        register,
        logout,
        refreshAuth,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
