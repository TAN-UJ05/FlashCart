import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
const SESSION_HINT_KEY = 'flashcart_has_session';

function getSessionHint(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function setSessionHint(hasSession: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    if (hasSession) {
      window.localStorage.setItem(SESSION_HINT_KEY, '1');
    } else {
      window.localStorage.removeItem(SESSION_HINT_KEY);
    }
  } catch {
    // Ignore storage restrictions
  }
}

let inFlightRefresh: Promise<User | null> | null = null;

async function performSessionRefresh(): Promise<User | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      try {
        const { data } = await authService.refreshToken();
        setAccessToken(data.accessToken);
        const userRes = await authService.getCurrentUser();
        setSessionHint(true);
        return userRes.data;
      } catch {
        setAccessToken(null);
        setSessionHint(false);
        return null;
      } finally {
        inFlightRefresh = null;
      }
    })();
  }
  return inFlightRefresh;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => getSessionHint());

  const refreshAuth = useCallback(async () => {
    const restoredUser = await performSessionRefresh();
    if (!restoredUser) {
      queryClient.clear();
    }
    setUser(restoredUser);
  }, [queryClient]);

  useEffect(() => {
    if (!getSessionHint()) {
      return;
    }
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

  const login = useCallback(
    async (email: string, password: string): Promise<User> => {
      const { data } = await authService.login({ email, password });
      setAccessToken(data.accessToken);
      const nextUser = data.user ?? (await authService.getCurrentUser()).data;
      setSessionHint(true);
      queryClient.clear();
      setUser(nextUser);
      return nextUser;
    },
    [queryClient]
  );

  const register = useCallback(
    async (payload: authService.RegisterPayload): Promise<User> => {
      const { data } = await authService.register(payload);
      if (data?.accessToken) {
        setAccessToken(data.accessToken);
      }
      const nextUser = data?.user ?? (await authService.getCurrentUser()).data;
      setSessionHint(true);
      queryClient.clear();
      setUser(nextUser);
      return nextUser;
    },
    [queryClient]
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setSessionHint(false);
      setAccessToken(null);
      setUser(null);
      queryClient.clear();
    }
  }, [queryClient]);

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
