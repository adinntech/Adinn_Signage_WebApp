export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");

export type Role =
  | "SUPER_ADMIN"
  | "BD"
  | "RECCE_COORDINATOR"
  | "RECCE_EXECUTIVE"
  | "VENDOR"
  | "OPERATIONS"
  | "FINANCE"
  | "MANAGEMENT";

export interface User {
  id: string;
  name: string;
  email: string;
  employeeId?: string | null;
  phone?: string | null;
  role: Role;
  isActive: boolean;
  authMethod?: AuthMethod;
  permissions: string[];
  /** Landing route for this role, decided by the backend. */
  home?: string;
}

export interface AuthPayload {
  accessToken: string;
  refreshToken?: string;
  remember?: boolean;
  user: User;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Access token is kept in memory only (never localStorage).
let accessToken: string | null = null;
let refreshInFlight: Promise<AuthPayload> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(fn: (() => void) | null) {
  onSessionExpired = fn;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Paged<T> {
  data: T[];
  meta: PageMeta;
}

async function parseEnvelope<T>(res: Response): Promise<{ data: T; meta?: PageMeta }> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON response */
  }
  const b = body as {
    success?: boolean;
    data?: T;
    meta?: PageMeta;
    error?: { code?: string; message?: string; details?: unknown };
  } | null;
  if (!res.ok || !b || b.success === false) {
    throw new ApiError(
      res.status,
      b?.error?.code ?? "UNKNOWN_ERROR",
      b?.error?.message ?? "Something went wrong. Please try again.",
      b?.error?.details,
    );
  }
  return { data: b.data as T, meta: b.meta };
}

async function rawEnvelope<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<{ data: T; meta?: PageMeta }> {
  const { auth = true, headers, ...rest } = init;
  const h = new Headers(headers);
  // JSON only for string bodies; FormData must get its multipart boundary from the browser.
  if (typeof rest.body === "string" && !h.has("Content-Type")) h.set("Content-Type", "application/json");
  if (auth && accessToken) h.set("Authorization", `Bearer ${accessToken}`);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...rest, headers: h, credentials: "include" });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Unable to reach the server. Check your connection and try again.");
  }
  return parseEnvelope<T>(res);
}

async function raw<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  return (await rawEnvelope<T>(path, init)).data;
}

/** Refresh via httpOnly cookie. Concurrent callers share one request (the token rotates). */
export function refreshSession(): Promise<AuthPayload> {
  if (!refreshInFlight) {
    refreshInFlight = raw<AuthPayload>("/auth/refresh", { method: "POST", body: "{}", auth: false })
      .then((p) => {
        accessToken = p.accessToken;
        return p;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function withRefresh<R>(fn: () => Promise<R>): Promise<R> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      try {
        await refreshSession();
      } catch {
        accessToken = null;
        onSessionExpired?.();
        throw err;
      }
      return fn();
    }
    throw err;
  }
}

/** Authenticated request; on 401 refreshes once and retries. */
export function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  return withRefresh(() => raw<T>(path, init));
}

/** Authenticated paginated request: returns { data, meta }. */
export async function apiPage<T>(path: string, init: RequestInit = {}): Promise<Paged<T>> {
  const env = await withRefresh(() => rawEnvelope<T[]>(path, init));
  const data = env.data ?? [];
  return { data, meta: env.meta ?? { page: 1, limit: data.length, total: data.length, totalPages: 1 } };
}

async function rawBlob(path: string): Promise<{ blob: Blob; fileName?: string }> {
  const h = new Headers();
  if (accessToken) h.set("Authorization", `Bearer ${accessToken}`);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers: h, credentials: "include" });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Unable to reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    await parseEnvelope<unknown>(res); // throws ApiError with the server's message
    throw new ApiError(res.status, "UNKNOWN_ERROR", "Download failed.");
  }
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = /filename="?([^";]+)"?/i.exec(cd);
  return { blob: await res.blob(), fileName: m?.[1] };
}

/** Authenticated binary download (exports/templates); on 401 refreshes once and retries. */
export function apiBlob(path: string): Promise<{ blob: Blob; fileName?: string }> {
  return withRefresh(() => rawBlob(path));
}

/** Save a blob to disk via a temporary link. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type FieldErrors = Record<string, string>;

/** Map a 422 VALIDATION_ERROR (details [{path,message}]) to { "a.0.b": message }. */
export function fieldErrorsOf(err: unknown): FieldErrors {
  const out: FieldErrors = {};
  if (!(err instanceof ApiError) || !Array.isArray(err.details)) return out;
  for (const d of err.details as { path?: string | (string | number)[]; message?: string }[]) {
    const path = Array.isArray(d.path) ? d.path.join(".") : (d.path ?? "");
    if (path && !out[path]) out[path] = d.message ?? "Invalid value";
  }
  return out;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

export type AuthMethod = "PASSWORD" | "MPIN";
/** A password or a 4-digit MPIN. Exactly one is sent, matching how the account was registered. */
export type Credential = { authMethod: "PASSWORD"; password: string } | { authMethod: "MPIN"; mpin: string };

const credentialBody = (c: Credential) => (c.authMethod === "MPIN" ? { mpin: c.mpin } : { password: c.password });

/** loginRole is the role card the person picked; the backend answers "User not found" if the account is not registered under it. */
export async function login(identifier: string, credential: Credential, remember: boolean, loginRole?: string): Promise<AuthPayload> {
  const p = await raw<AuthPayload>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, ...credentialBody(credential), remember, loginRole, platform: "web" }),
    auth: false,
  });
  accessToken = p.accessToken;
  return p;
}

/** Whether the Admin role can still be self-registered (only until the first admin exists). */
export function fetchRegisterOptions(): Promise<{ adminAvailable: boolean }> {
  return raw("/auth/register-options", { auth: false });
}

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  employeeId: string;
  role: Role;
  credential: Credential;
}

/** Creates the account and signs the user in (same payload as login). */
export async function registerAccount({ credential, ...rest }: RegisterInput): Promise<AuthPayload> {
  const p = await raw<AuthPayload>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ ...rest, authMethod: credential.authMethod, ...credentialBody(credential), platform: "web", remember: true }),
    auth: false,
  });
  accessToken = p.accessToken;
  return p;
}

export async function logout(): Promise<void> {
  try {
    await raw<unknown>("/auth/logout", { method: "POST", body: "{}" });
  } finally {
    accessToken = null;
  }
}
