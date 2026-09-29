"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi, type CurrentUser } from "@/lib/api/auth";
import { ApiError, onSessionExpired, TOKEN_KEYS, tokenStore } from "@/lib/api/client";

/** `error`: there is a session but the server could not be reached to confirm it. */
type AuthStatus = "loading" | "authenticated" | "anonymous" | "error";

interface AuthContextValue {
  user: CurrentUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<CurrentUser>;
  logout: () => void;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const RETRY_DELAYS_MS = [800, 2000];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const statusRef = useRef(status);
  statusRef.current = status;

  const clearSession = useCallback(() => {
    setUser(null);
    setStatus("anonymous");
    queryClient.clear();
  }, [queryClient]);

  /** Confirm the stored session. Transient failures (network, 5xx, cold starts) are retried. */
  const loadUser = useCallback(async () => {
    if (!tokenStore.access()) {
      clearSession();
      return;
    }
    setStatus("loading");
    for (let attempt = 0; ; attempt += 1) {
      try {
        const me = await authApi.me();
        setUser(me);
        setStatus("authenticated");
        return;
      } catch (error) {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          tokenStore.clear(); // the server rejected this session (expired, revoked or deactivated)
          clearSession();
          return;
        }
        if (attempt >= RETRY_DELAYS_MS.length) {
          setStatus("error");
          return;
        }
        await wait(RETRY_DELAYS_MS[attempt]);
      }
    }
  }, [clearSession]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => onSessionExpired(clearSession), [clearSession]);

  // Keep tabs in sync: signing out (or in) in one tab updates the others.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== TOKEN_KEYS.access) return;
      if (!tokenStore.access()) {
        if (statusRef.current !== "anonymous") clearSession();
      } else if (statusRef.current === "anonymous") {
        void loadUser();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [clearSession, loadUser]);

  const login = useCallback(async (email: string, password: string) => {
    const me = await authApi.login(email, password);
    setUser(me);
    setStatus("authenticated");
    return me;
  }, []);

  const logout = useCallback(() => {
    void authApi.logout(); // clears the tokens right away; the server call is best effort
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === "authenticated",
      isLoading: status === "loading",
      login,
      logout,
      retry: () => void loadUser(),
    }),
    [user, status, login, logout, loadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

/** Home route for a user after signing in. */
export function homeFor(user: Pick<CurrentUser, "role"> | null): string {
  return user?.role === "admin" ? "/admin" : "/learn";
}
