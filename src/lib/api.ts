/**
 * Thin, typed client for the UV Active Cloud API — staff (branch) realm only.
 *
 * Every response from the API is wrapped in an envelope:
 *   success: { success: true, data: T, meta?: {...} }
 *   error:   { success: false, error: { code, message }, path }
 * (see cloud-api ResponseEnvelopeInterceptor / AllExceptionsFilter)
 *
 * This client unwraps `data`, surfaces `meta` alongside it, and throws an
 * `ApiError` (carrying `code` + `message`) on failure so callers can match
 * on `error.code` — in particular GYM_SUSPENDED, which App-level code uses
 * to swap the whole content area for the suspended-branch lockout screen
 * instead of rendering a broken page.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

const ACCESS_TOKEN_KEY = "uva_staff_access_token";
const REFRESH_TOKEN_KEY = "uva_staff_refresh_token";
const STAFF_PROFILE_KEY = "uva_staff_profile";

export interface StaffProfile {
  id: string;
  name: string;
  email: string;
  role: "trainer" | "branch_manager";
  gymId: string;
  gymName: string;
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// ── Branch-suspension broadcast ──────────────────────────────────────
// A gym can be suspended by Admin at any moment, mid-session. Every
// screen must treat that as a real state, not a toast — so the very
// first GYM_SUSPENDED response from ANY request (not just login) flips
// a flag every layout can subscribe to and swap its whole content area
// for the lockout screen. See BranchLayout / useGymSuspended.
type SuspensionListener = () => void;
const suspensionListeners = new Set<SuspensionListener>();
export function onGymSuspended(listener: SuspensionListener): () => void {
  suspensionListeners.add(listener);
  return () => suspensionListeners.delete(listener);
}

// ── Token storage ──────────────────────────────────────────────────────
export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  getProfile: (): StaffProfile | null => {
    const raw = localStorage.getItem(STAFF_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  set: (accessToken: string, refreshToken: string, profile: StaffProfile) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(STAFF_PROFILE_KEY, JSON.stringify(profile));
  },
  setAccess: (accessToken: string) => localStorage.setItem(ACCESS_TOKEN_KEY, accessToken),
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(STAFF_PROFILE_KEY);
  },
};

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return false;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ realm: "staff", refreshToken }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) return false;
        tokenStore.setAccess(json.data.accessToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean; // defaults to true
  query?: Record<string, string | number | boolean | undefined>;
}

async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const { method = "GET", body, auth = true, query } = opts;

  let url = `${BASE_URL}${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const doFetch = async () => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth) {
      const token = tokenStore.getAccess();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    return fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch();

  if (res.status === 401 && auth) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await doFetch();
  }

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.success) {
    const code = json?.error?.code || "UNKNOWN_ERROR";
    const message = json?.error?.message || `Request failed with status ${res.status}`;
    if (res.status === 401) {
      tokenStore.clear();
    }
    if (code === "GYM_SUSPENDED") {
      suspensionListeners.forEach((l) => l());
    }
    throw new ApiError(code, message, res.status);
  }

  return { data: json.data as T, meta: json.meta };
}

export const api = {
  get: <T = unknown>(path: string, query?: RequestOptions["query"]) => request<T>(path, { method: "GET", query }),
  post: <T = unknown>(path: string, body?: unknown, opts?: Partial<RequestOptions>) => request<T>(path, { method: "POST", body, ...opts }),
  patch: <T = unknown>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T = unknown>(path: string) => request<T>(path, { method: "DELETE" }),
};
