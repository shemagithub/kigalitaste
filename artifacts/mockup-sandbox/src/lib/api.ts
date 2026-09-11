const TOKEN_KEY = "kt_token";

/** Live cPanel API — used for local Vite and production builds. */
export const DEFAULT_API_BASE = "https://backend.kigalitaste.co";

/**
 * Override with VITE_API_BASE in .env if needed.
 * Set VITE_API_BASE= (empty) to use the Vite proxy → local :5050 instead.
 */
const raw = import.meta.env.VITE_API_BASE;
export const API_BASE = (
  raw === undefined ? DEFAULT_API_BASE : String(raw).trim() || ""
).replace(/\/$/, "");

export function apiUrl(path: string) {
  if (!path) return API_BASE || "/";
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  payload: Record<string, unknown>;

  constructor(message: string, status: number, payload: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit & { json?: unknown; form?: FormData } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let body = options.body;
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  } else if (options.form) {
    body = options.form;
  }

  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      ...options,
      cache: "no-store",
      headers,
      body,
    });
  } catch {
    throw new ApiError(
      API_BASE
        ? `Cannot reach API at ${API_BASE}. Is the Node app online?`
        : "Backend API is not running. From the project root run: pnpm dev",
      0,
    );
  }

  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    needsVerification?: boolean;
    email?: string;
  };
  if (!res.ok) {
    const fallback =
      res.status === 503
        ? API_BASE
          ? `API unavailable at ${API_BASE}`
          : "Backend API is not running. From the project root run: pnpm dev"
        : "Something went wrong";
    throw new ApiError(data.error || fallback, res.status, data as Record<string, unknown>);
  }
  return data;
}

export function frw(amount: number) {
  return `${Math.round(amount).toLocaleString("en-RW")} FRw`;
}

export const PHOTO =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80";

/** Resolve image URLs; relative /uploads paths go to the API host. */
export function img(src?: string | null) {
  if (!src) return PHOTO;
  const rawSrc = String(src).trim();
  if (!rawSrc) return PHOTO;
  if (/^https?:\/\//i.test(rawSrc) || rawSrc.startsWith("data:") || rawSrc.startsWith("blob:")) {
    return rawSrc;
  }
  if (rawSrc.startsWith("/uploads") || rawSrc.startsWith("uploads/")) {
    const path = rawSrc.startsWith("/") ? rawSrc : `/${rawSrc}`;
    return apiUrl(path);
  }
  if (rawSrc.startsWith("/")) return apiUrl(rawSrc);
  return rawSrc;
}
