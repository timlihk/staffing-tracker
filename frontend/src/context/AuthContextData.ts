import { createContext } from 'react';
import type { User, LoginRequest } from '../types';

export interface LoginResult {
  requiresPasswordReset: boolean;
  resetToken?: string;
  username?: string;
  message?: string;
}

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginRequest) => Promise<LoginResult>;
  logout: () => void;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
