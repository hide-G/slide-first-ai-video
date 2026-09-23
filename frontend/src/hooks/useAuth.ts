/**
 * AWS Amplify を使った認証フック。
 */

import { useState, useEffect, useCallback } from "react";
import {
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  getCurrentUser,
  fetchAuthSession,
  resetPassword as amplifyResetPassword,
  confirmResetPassword as amplifyConfirmResetPassword,
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  resendSignUpCode as amplifyResendSignUpCode,
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
  /** パスワードリセット用の確認コード送信を要求する。 */
  requestPasswordReset: (username: string) => Promise<void>;
  /** 確認コードと新しいパスワードでリセットを確定する。 */
  confirmPasswordReset: (
    username: string,
    confirmationCode: string,
    newPassword: string,
  ) => Promise<void>;
  /** 新規アカウントを登録する（確認コードがメール送信される）。 */
  signUp: (username: string, password: string) => Promise<void>;
  /** 新規登録の確認コードを検証してアカウントを有効化する。 */
  confirmSignUp: (username: string, confirmationCode: string) => Promise<void>;
  /** 新規登録の確認コードを再送する。 */
  resendSignUpCode: (username: string) => Promise<void>;
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

  const requestPasswordReset = useCallback(async (username: string) => {
    await amplifyResetPassword({ username });
  }, []);

  const confirmPasswordReset = useCallback(
    async (username: string, confirmationCode: string, newPassword: string) => {
      await amplifyConfirmResetPassword({ username, confirmationCode, newPassword });
    },
    [],
  );

  const signUp = useCallback(async (username: string, password: string) => {
    await amplifySignUp({
      username,
      password,
      options: { userAttributes: { email: username } },
    });
  }, []);

  const confirmSignUp = useCallback(
    async (username: string, confirmationCode: string) => {
      await amplifyConfirmSignUp({ username, confirmationCode });
    },
    [],
  );

  const resendSignUpCode = useCallback(async (username: string) => {
    await amplifyResendSignUpCode({ username });
  }, []);

  return {
    ...state,
    signIn,
    signOut,
    getIdToken,
    requestPasswordReset,
    confirmPasswordReset,
    signUp,
    confirmSignUp,
    resendSignUpCode,
  };
}
