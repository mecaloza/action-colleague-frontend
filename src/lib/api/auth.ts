import { ApiError, apiRequest, http, tokenStore } from "./client";
import type { Role } from "./types";

export type { Role };

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  position?: string | null;
  department?: string | null;
  is_active?: boolean;
  created_at?: string | null;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  role: Role;
}

const LOGIN_ERRORS: Record<number, string> = {
  401: "Correo o contraseña incorrectos.",
  403: "Tu cuenta está desactivada. Habla con tu administrador.",
  422: "Escribe un correo y una contraseña válidos.",
};

function loginError(error: unknown): unknown {
  if (error instanceof ApiError && LOGIN_ERRORS[error.status]) {
    return new ApiError(error.status, LOGIN_ERRORS[error.status], error.detail, error.requestId);
  }
  return error;
}

export const authApi = {
  async login(email: string, password: string): Promise<CurrentUser> {
    let tokens: TokenResponse;
    try {
      tokens = await apiRequest<TokenResponse>("/auth/login", {
        method: "POST",
        body: { email: email.trim(), password },
        auth: false,
      });
    } catch (error) {
      throw loginError(error);
    }
    tokenStore.set(tokens.access_token, tokens.refresh_token);
    return authApi.me();
  },

  me: () => http.get<CurrentUser>("/auth/me"),

  /** Own name, or password (the current one is required). A new password ends every session. */
  updateMe: (changes: { name?: string; current_password?: string; new_password?: string }) =>
    http.patch<CurrentUser>("/auth/me", changes),

  async logout(): Promise<void> {
    const refresh = tokenStore.refresh();
    tokenStore.clear();
    if (!refresh) return;
    try {
      await apiRequest("/auth/logout", { method: "POST", body: { refresh_token: refresh }, auth: false });
    } catch {
      // Best effort: the local session is already gone.
    }
  },
};
