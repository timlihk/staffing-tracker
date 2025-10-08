import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import apiClient from '../api/client';
import type { LoginRequest, LoginResponse } from '../types';
import { toast } from '../lib/toast';
import { AuthContext, type AuthContextValue } from './AuthContextData';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

type PasswordResetError = {
  requiresPasswordReset: boolean;
  resetToken?: string;
  error?: string;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthContextValue['user']>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login: AuthContextValue['login'] = async (credentials: LoginRequest) => {
    try {
      const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);

      return { requiresPasswordReset: false };
    } catch (error: unknown) {
      if (
        isAxiosError<PasswordResetError>(error) &&
        error.response?.status === 403 &&
        error.response.data?.requiresPasswordReset
      ) {
        return {
          requiresPasswordReset: true,
          resetToken: error.response.data.resetToken,
          username: credentials.username,
          message: error.response.data.error,
        };
      }
      throw error;
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  useEffect(() => {
    if (!user) return;

    const activityEvents: Array<keyof WindowEventMap> = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const handleInactivityLogout = () => {
      toast.info('Session expired', 'You were logged out after 30 minutes of inactivity.');
      logout();
    };

    const resetTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(handleInactivityLogout, INACTIVITY_TIMEOUT_MS);
    };

    activityEvents.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      activityEvents.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [user, logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
