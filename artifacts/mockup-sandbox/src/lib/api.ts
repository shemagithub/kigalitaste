const TOKEN_KEY = "kt_token";
const API_BASE_KEY = "kt_api_base";

/** Remote Node API host (used when same-origin proxy is not available). */
export const DEFAULT_API_HOST = "backend.kigalitaste.co";
export const DEFAULT_API_BASE = `https://${DEFAULT_API_HOST}`;

const envBase = String(import.meta.env.VITE_API_BASE ?? "")
  .trim()
  .replace(/\/$/, "");

function pageProtocol(): "http:" | "https:" {
  if (typeof window === "undefined") return "https:";
  return window.location.protocol === "http:" ? "http:" : "https:";
}

function canUseHttp(): boolean {
  // HTTPS pages block http:// fetches (mixed content). HTTP pages may use either.
  return pageProtocol() === "http:";
}

function readStoredBase(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(API_BASE_KEY);
  } catch {
    return null;
  }
}

function writeStoredBase(base: string) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(API_BASE_KEY, base);
  } catch {
    /* private mode / quota */
  }
}

/**
 * Candidate API origins, first-success wins.
 * Same-origin ("") is preferred so phones never need a certificate on the backend.
 */
export function candidateApiBases(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (value: string) => {
    const base = value.replace(/\/$/, "");
    if (seen.has(base)) return;
    seen.add(base);
    out.push(base);
  };

  const stored = readStoredBase();
  if (stored !== null) add(stored);
  if (envBase) add(envBase);

  add(""); // same origin — Apache/PHP or Vite proxy

  if (canUseHttp()) {
    add(`http://${DEFAULT_API_HOST}`);
    add(`https://${DEFAULT_API_HOST}`);
  } else {
    add(`https://${DEFAULT_API_HOST}`);
  }

  return out;
}

function initialApiBase(): string {
  const stored = readStoredBase();
  if (stored !== null) return stored;
  if (envBase) return envBase;
  return "";
}

/** Live binding: updated when a working origin is discovered. Empty = same origin. */
export let API_BASE = initialApiBase();

export function setApiBase(base: string) {
  API_BASE = base.replace(/\/$/, "");
  writeStoredBase(API_BASE);
}

export function apiUrl(path: string): string {
  if (!path) return API_BASE || "/";
  if (/^https?:\/\//i.test(path)) return rewriteBackendUrl(path);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

function joinBase(base: string, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

function rewriteBackendUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.replace(/^www\./, "") === DEFAULT_API_HOST) {
      return apiUrl(`${parsed.pathname}${parsed.search}`);
    }
  } catch {
    /* keep original */
  }
  return url;
}

function looksLikeSpaFallback(res: Response, path: string) {
  if (!path.startsWith("/api")) return false;
  const type = (res.headers.get("content-type") || "").toLowerCase();
  return type.includes("text/html");
}

function shouldTryNextBase(res: Response, path: string) {
  if (res.status === 502 || res.status === 503 || res.status === 504) return true;
  if (looksLikeSpaFallback(res, path)) return true;
  return false;
}

function timeoutSignal(ms: number, existing?: AbortSignal | null): AbortSignal | undefined {
  const extra: AbortSignal[] = [];
  if (existing) extra.push(existing);
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    extra.push(AbortSignal.timeout(ms));
  }
  if (extra.length === 0) return existing ?? undefined;
  if (extra.length === 1) return extra[0];
  if (typeof AbortSignal.any === "function") return AbortSignal.any(extra);
  return extra[0];
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

function unreachableMessage() {
  return API_BASE
    ? `Cannot reach API at ${API_BASE}. Is the Node app online?`
    : "Cannot reach the API. Check your connection and try again.";
}

/** Fetch a path against each candidate origin until one responds as the API. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const bases = candidateApiBases();
  let lastNetworkError: unknown;

  for (const base of bases) {
    try {
      const res = await fetch(joinBase(base, normalized), {
        ...init,
        cache: "no-store",
        signal: timeoutSignal(25000, init.signal),
      });
      if (shouldTryNextBase(res, normalized)) {
        lastNetworkError = new Error(`API unavailable (${res.status})`);
        continue;
      }
      setApiBase(base);
      return res;
    } catch (err) {
      lastNetworkError = err;
    }
  }

  throw lastNetworkError instanceof ApiError
    ? lastNetworkError
    : new ApiError(unreachableMessage(), 0);
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

  const { json: _json, form: _form, ...rest } = options;
  let res: Response;
  try {
    res = await apiFetch(path, { ...rest, headers, body });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(unreachableMessage(), 0);
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
          : "Backend API is not running"
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

/** Resolve image URLs; relative /uploads paths go to the working API origin. */
export function img(src?: string | null) {
  if (!src) return PHOTO;
  const rawSrc = String(src).trim();
  if (!rawSrc) return PHOTO;
  if (rawSrc.startsWith("data:") || rawSrc.startsWith("blob:")) return rawSrc;
  if (/^https?:\/\//i.test(rawSrc)) return rewriteBackendUrl(rawSrc);
  if (rawSrc.startsWith("/uploads") || rawSrc.startsWith("uploads/")) {
    const path = rawSrc.startsWith("/") ? rawSrc : `/${rawSrc}`;
    return apiUrl(path);
  }
  if (rawSrc.startsWith("/")) return apiUrl(rawSrc);
  return rawSrc;
}

if (typeof window !== "undefined") {
  void apiFetch("/api/health", { method: "GET" }).catch(() => {
    /* first real request will retry */
  });
}
