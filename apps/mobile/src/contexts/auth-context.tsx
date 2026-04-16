import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { AuthUser, AuthResponse } from "@karakas/shared";
import { apiFetch } from "../lib/api";
import { getTokens, setTokens, clearTokens } from "../lib/secure-store";

type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

type AuthContextType = AuthState & {
  login: (identifier: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Check for existing session on mount
  useEffect(() => {
    (async () => {
      try {
        const tokens = await getTokens();
        if (tokens?.accessToken) {
          const data = await apiFetch<{ user: AuthUser }>("/api/v1/auth/me");
          setState({ user: data.user, isLoading: false, isAuthenticated: true });
          return;
        }
      } catch {
        await clearTokens();
      }
      setState({ user: null, isLoading: false, isAuthenticated: false });
    })();
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await apiFetch<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
      skipAuth: true,
    });
    await setTokens(data.accessToken, data.refreshToken);
    setState({ user: data.user, isLoading: false, isAuthenticated: true });
  }, []);

  const signup = useCallback(
    async (username: string, email: string, password: string) => {
      const data = await apiFetch<AuthResponse>("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
        skipAuth: true,
      });
      await setTokens(data.accessToken, data.refreshToken);
      setState({ user: data.user, isLoading: false, isAuthenticated: true });
    },
    []
  );

  const logout = useCallback(async () => {
    await clearTokens();
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
