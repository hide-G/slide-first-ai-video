import { useState, useCallback, useEffect } from "react";
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { config } from "../config";

const userPool = new CognitoUserPool({
  UserPoolId: config.cognitoUserPoolId,
  ClientId: config.cognitoClientId,
});

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  email: string | null;
  idToken: string | null;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    email: null,
    idToken: null,
    error: null,
  });

  // セッション復元
  useEffect(() => {
    const currentUser = userPool.getCurrentUser();
    if (currentUser) {
      currentUser.getSession(
        (err: Error | null, session: CognitoUserSession | null) => {
          if (err || !session || !session.isValid()) {
            setState((s) => ({ ...s, isLoading: false }));
            return;
          }
          setState({
            isAuthenticated: true,
            isLoading: false,
            email: currentUser.getUsername(),
            idToken: session.getIdToken().getJwtToken(),
            error: null,
          });
        },
      );
    } else {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, error: null }));
    return new Promise<void>((resolve, reject) => {
      const attributes = [
        new CognitoUserAttribute({ Name: "email", Value: email }),
      ];
      userPool.signUp(email, password, attributes, [], (err) => {
        if (err) {
          setState((s) => ({ ...s, error: err.message }));
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }, []);

  const confirmSignUp = useCallback(async (email: string, code: string) => {
    setState((s) => ({ ...s, error: null }));
    return new Promise<void>((resolve, reject) => {
      const user = new CognitoUser({ Username: email, Pool: userPool });
      user.confirmRegistration(code, true, (err) => {
        if (err) {
          setState((s) => ({ ...s, error: err.message }));
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, error: null }));
    return new Promise<void>((resolve, reject) => {
      const user = new CognitoUser({ Username: email, Pool: userPool });
      const authDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });
      user.authenticateUser(authDetails, {
        onSuccess: (session) => {
          setState({
            isAuthenticated: true,
            isLoading: false,
            email,
            idToken: session.getIdToken().getJwtToken(),
            error: null,
          });
          resolve();
        },
        onFailure: (err) => {
          setState((s) => ({ ...s, error: err.message }));
          reject(err);
        },
      });
    });
  }, []);

  const signOut = useCallback(() => {
    const currentUser = userPool.getCurrentUser();
    if (currentUser) {
      currentUser.signOut();
    }
    setState({
      isAuthenticated: false,
      isLoading: false,
      email: null,
      idToken: null,
      error: null,
    });
  }, []);

  return { ...state, signUp, confirmSignUp, signIn, signOut };
}
