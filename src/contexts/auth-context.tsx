"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { User } from "@/lib/types";
import { api } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: async () => {},
  logout: () => {},
  isAuthenticated: false,
  isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, check for existing token and validate it
  useEffect(() => {
    const savedToken = localStorage.getItem("ac_token");
    const savedUser = localStorage.getItem("ac_user");

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      // Try to refresh user data from API
      api
        .getMe()
        .then((freshUser) => {
          setUser(freshUser);
          localStorage.setItem("ac_user", JSON.stringify(freshUser));
        })
        .catch(() => {
          // Token might be invalid but keep mock data working
        });
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login({ email, password });
    const { access_token, refresh_token, user: userData } = response;

    setToken(access_token);
    setUser(userData);
    localStorage.setItem("ac_token", access_token);
    if (refresh_token) {
      localStorage.setItem("ac_refresh_token", refresh_token);
    }
    localStorage.setItem("ac_user", JSON.stringify(userData));
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!user && !!token,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
