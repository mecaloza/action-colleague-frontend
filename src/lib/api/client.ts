/**
 * HTTP client for the Action Colleague API: JSON in/out, bearer auth with transparent
 * refresh-token rotation, and errors translated into readable Spanish messages.
 */

const DEFAULT_API =
  process.env.NODE_ENV === "production"
    ? "https://colleague-backend-production.up.railway.app/api/v1"
    : "http://localhost:8001/api/v1";

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API).replace(/\/$/, "");

const ACCESS_KEY = "ac_token";
const REFRESH_KEY = "ac_refresh_token";
const LEGACY_USER_KEY = "ac_user"; // user cache written by the previous app version

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detail?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export const TOKEN_KEYS = { access: ACCESS_KEY, refresh: REFRESH_KEY } as const;

export const tokenStore = {
  access: () => storage()?.getItem(ACCESS_KEY) ?? null,
  refresh: () => storage()?.getItem(REFRESH_KEY) ?? null,
  set(access: string, refresh: string) {
    storage()?.setItem(ACCESS_KEY, access);
    storage()?.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    storage()?.removeItem(ACCESS_KEY);
    storage()?.removeItem(REFRESH_KEY);
    storage()?.removeItem(LEGACY_USER_KEY);
  },
};

type ExpiredListener = () => void;
const expiredListeners = new Set<ExpiredListener>();

/** Called when the session cannot be refreshed; the auth provider uses it to sign the user out. */
export function onSessionExpired(listener: ExpiredListener): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

const UNEXPECTED_ERROR = "Ocurrió un error inesperado. Intenta de nuevo.";
const NETWORK_ERROR = "No pudimos conectar con el servidor. Revisa tu conexión.";
const SERVER_ERROR = "El servidor tuvo un problema. Intenta de nuevo en unos segundos.";

export const STATUS_MESSAGES: Record<number, string> = {
  400: "La solicitud no es válida.",
  401: "Tu sesión expiró. Vuelve a iniciar sesión.",
  403: "No tienes permiso para hacer esto.",
  404: "No encontramos lo que buscas.",
  409: "La acción entra en conflicto con el estado actual.",
  413: "El archivo es demasiado grande.",
  422: "Revisa los datos del formulario.",
  429: "Demasiadas solicitudes. Intenta de nuevo en un momento.",
};

/** Messages still sent in English by endpoints from the previous API version. */
const LEGACY_DETAILS: Record<string, string> = {
  "Invalid email or password": "Correo o contraseña incorrectos.",
  "Account deactivated": "Tu cuenta está desactivada. Habla con tu administrador.",
  "Email already registered": "Ya existe un usuario con ese correo.",
  "User already enrolled in this course": "Esta persona ya está inscrita en el curso.",
  "Access denied": STATUS_MESSAGES[403],
  "Not authenticated": STATUS_MESSAGES[401],
  "Could not validate credentials": STATUS_MESSAGES[401],
};

function messageFrom(status: number, detail: unknown): string {
  if (status >= 500) {
    // The API explains its 502 and 503 (a provider failed, a service isn't configured) in Spanish.
    const explained = (status === 502 || status === 503) && typeof detail === "string" ? detail.trim() : "";
    return explained || SERVER_ERROR;
  }
  const text =
    typeof detail === "string"
      ? detail.trim()
      : detail && typeof detail === "object" && "message" in detail && typeof detail.message === "string"
        ? detail.message.trim()
        : "";
  if (text) {
    if (LEGACY_DETAILS[text]) return LEGACY_DETAILS[text];
    if (/not found/i.test(text)) return STATUS_MESSAGES[404];
    if (/not configured/i.test(text)) return "Esta función no está configurada en el servidor.";
    return text;
  }
  // Arrays are FastAPI validation errors (English, field-level): show the generic message.
  return STATUS_MESSAGES[status] ?? UNEXPECTED_ERROR;
}

async function toApiError(response: Response): Promise<ApiError> {
  const body: { detail?: unknown; request_id?: string } | undefined = await response.json().catch(() => undefined);
  const requestId = body?.request_id ?? response.headers.get("x-request-id") ?? undefined;
  return new ApiError(response.status, messageFrom(response.status, body?.detail), body?.detail, requestId);
}

function expireSession(): ApiError {
  tokenStore.clear();
  expiredListeners.forEach((listener) => listener());
  return new ApiError(401, STATUS_MESSAGES[401]);
}

/**
 * Exchange the refresh token for new tokens. Refresh tokens are single-use and shared by every
 * tab, so a tab that loses the race must adopt the winner's tokens instead of signing out.
 */
async function requestNewTokens(staleAccess: string | null): Promise<string> {
  const current = tokenStore.access();
  if (current && current !== staleAccess) return current; // another tab already refreshed
  const refresh = tokenStore.refresh();
  if (!refresh) throw expireSession();

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR);
  }

  if (!response.ok) {
    const error = await toApiError(response);
    const rotatedMeanwhile = tokenStore.refresh() !== refresh ? tokenStore.access() : null;
    if (rotatedMeanwhile) return rotatedMeanwhile;
    // Only a rejected refresh token ends the session; 429, 5xx or network errors keep it.
    if ([400, 401, 403].includes(error.status)) throw expireSession();
    throw error;
  }

  const data = (await response.json()) as { access_token: string; refresh_token: string };
  tokenStore.set(data.access_token, data.refresh_token);
  return data.access_token;
}

let refreshInFlight: Promise<string> | null = null;

/** One refresh at a time per tab, and across tabs when the browser supports Web Locks. */
export function refreshAccessToken(staleAccess: string | null): Promise<string> {
  if (!refreshInFlight) {
    const run = () => requestNewTokens(staleAccess);
    const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
    const pending: Promise<string> = locks ? (async () => await locks.request("ac-token-refresh", run))() : run();
    refreshInFlight = pending.finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
  auth?: boolean;
  signal?: AbortSignal;
  /** "blob" for binary responses (images, audio); JSON otherwise. */
  as?: "json" | "blob";
  /** Let the request finish after the page closes (e.g. saving where a video was left). */
  keepalive?: boolean;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  return url.toString();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, auth = true, signal, as = "json", keepalive } = options;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const url = buildUrl(path, query);

  const send = async (token: string | null) => {
    try {
      return await fetch(url, {
        method,
        signal,
        keepalive,
        headers: {
          ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
          ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      });
    } catch (error) {
      if (signal?.aborted) throw error; // cancelled on purpose (e.g. React Query): not a network failure
      throw new ApiError(0, NETWORK_ERROR);
    }
  };

  const usedToken = auth ? tokenStore.access() : null;
  let response = await send(usedToken);
  if (response.status === 401 && auth) response = await send(await refreshAccessToken(usedToken));

  if (!response.ok) throw await toApiError(response);
  if (as === "blob") return (await response.blob()) as T;
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(response.status, UNEXPECTED_ERROR, text.slice(0, 200));
  }
}

export const http = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => apiRequest<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PATCH", body }),
  delete: <T = void>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
};

/** Human-readable message for any thrown value (for toasts and inline errors). */
export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : UNEXPECTED_ERROR;
}
