export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");

export type Role =
  | "SUPER_ADMIN"
  | "BD"
  | "CLIENT_SERVICING"
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
/** The current access token, for the live (Socket.IO) connection. */
export const getAccessToken = () => accessToken;
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

/** Emails a 6-digit reset code. The reply is always the same, whether or not the account exists. */
export function requestResetCode(identifier: string): Promise<{ message: string; expiresInMinutes: number; resendAfterSeconds: number }> {
  return raw("/auth/forgot", { method: "POST", body: JSON.stringify({ identifier }), auth: false });
}

/** Checks the emailed code and sets the new MPIN or password. The user signs in again afterwards. */
export function confirmReset(identifier: string, code: string, credential: Credential): Promise<{ authMethod: AuthMethod }> {
  const newSecret = credential.authMethod === "MPIN" ? credential.mpin : credential.password;
  return raw("/auth/forgot/confirm", { method: "POST", body: JSON.stringify({ identifier, code, authMethod: credential.authMethod, newSecret }), auth: false });
}

export async function logout(): Promise<void> {
  try {
    await raw<unknown>("/auth/logout", { method: "POST", body: "{}" });
  } finally {
    accessToken = null;
  }
}

/**
 * Opens a Server-Sent Events stream with the same bearer token and refresh handling as every other call
 * (the browser's EventSource cannot send an Authorization header). Reconnects with backoff, including after the
 * server ends the stream when the access token expires. Returns a function that stops it.
 */
export function openEventStream(path: string, onEvent: (event: string, data: unknown) => void): () => void {
  let stopped = false;
  const ctrl = new AbortController();
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  (async () => {
    let delay = 1000;
    while (!stopped) {
      try {
        const h = new Headers({ Accept: "text/event-stream" });
        if (accessToken) h.set("Authorization", `Bearer ${accessToken}`);
        const res = await fetch(`${API_URL}${path}`, { headers: h, credentials: "include", signal: ctrl.signal });
        if (res.status === 401) {
          try {
            await refreshSession();
          } catch {
            accessToken = null;
            onSessionExpired?.();
            return;
          }
          continue;
        }
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
        delay = 1000;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const ev = /^event: (.+)$/m.exec(block)?.[1];
            const data = /^data: (.+)$/m.exec(block)?.[1];
            if (ev && data) {
              try {
                onEvent(ev, JSON.parse(data));
              } catch {
                /* ignore a malformed frame */
              }
            }
          }
        }
      } catch {
        if (stopped) return;
      }
      if (stopped) return;
      await wait(delay);
      delay = Math.min(delay * 2, 30_000);
    }
  })();

  return () => {
    stopped = true;
    ctrl.abort();
  };
}

/**
 * Multipart upload with real progress (fetch cannot report upload progress, XMLHttpRequest can).
 * Uses the same bearer token and refresh-once-on-401 handling as every other call.
 */
export function apiUpload<T>(path: string, body: FormData, opts: { onProgress?: (percent: number) => void; signal?: AbortSignal } = {}): Promise<T> {
  const attempt = () =>
    new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}${path}`);
      xhr.withCredentials = true;
      if (accessToken) xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) opts.onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      };
      xhr.onload = () => {
        let b: { success?: boolean; data?: T; error?: { code?: string; message?: string; details?: unknown } } | null = null;
        try {
          b = JSON.parse(xhr.responseText);
        } catch {
          /* non-JSON response */
        }
        if (xhr.status >= 200 && xhr.status < 300 && b?.success !== false) {
          opts.onProgress?.(100);
          resolve(b?.data as T);
        } else {
          reject(new ApiError(xhr.status, b?.error?.code ?? "UNKNOWN_ERROR", b?.error?.message ?? "Upload failed. Please try again.", b?.error?.details));
        }
      };
      xhr.onerror = () => reject(new ApiError(0, "NETWORK_ERROR", "Unable to reach the server. Check your connection and try again."));
      xhr.onabort = () => reject(new ApiError(0, "ABORTED", "Upload cancelled."));
      opts.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
      xhr.send(body);
    });
  return withRefresh(attempt);
}
