/**
 * Authentication hook using AWS Amplify.
 */

import { useState, useEffect, useCallback } from "react";
import {
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  getCurrentUser,
  fetchAuthSession,
} from "aws-amplify/auth";

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  username: string | null;
}

export interface UseAuthReturn extends AuthState {
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    userId: null,
    username: null,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const user = await getCurrentUser();
      setState({
        isAuthenticated: true,
        isLoading: false,
        userId: user.userId,
        username: user.username,
      });
    } catch {
      setState({
        isAuthenticated: false,
        isLoading: false,
        userId: null,
        username: null,
      });
    }
  }

  const signIn = useCallback(async (username: string, password: string) => {
    await amplifySignIn({ username, password });
    await checkAuth();
  }, []);

  const signOut = useCallback(async () => {
    await amplifySignOut();
    setState({
      isAuthenticated: false,
      isLoading: false,
      userId: null,
      username: null,
    });
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() ?? null;
    } catch {
      return null;
    }
  }, []);

  return {
    ...state,
    signIn,
    signOut,
    getIdToken,
  };
}
