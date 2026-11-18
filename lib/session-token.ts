/**
 * Server-side check of the backend's access JWT (HS256) using Web Crypto, so it runs in the Next proxy
 * (edge-style runtime) without a library. Needs JWT_ACCESS_SECRET, the same secret the API signs with.
 *
 * `allowExpired` lets the proxy accept a token whose 15 minute life is over: the browser then renews it
 * silently through the refresh cookie and re-posts it to /session. The API still enforces real expiry on
 * every data call, so an old token only ever opens the page shell, never data.
 */
export interface SessionClaims {
  sub: string;
  role: string;
  exp?: number;
}

/** An expired token is still accepted for this long after expiry (matches the 30 day refresh window). */
export const EXPIRED_GRACE_SECONDS = 30 * 86400;

const b64urlToBytes = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

export async function verifySessionToken(token: string | undefined, secret: string | undefined, allowExpired = false): Promise<SessionClaims | null> {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts as [string, string, string];
  try {
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h))) as { alg?: string };
    if (header.alg !== "HS256") return null;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return null;
    const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(p))) as SessionClaims;
    if (!claims.sub || !claims.role) return null;
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp !== undefined) {
      if (!allowExpired && claims.exp < now) return null;
      if (allowExpired && claims.exp + EXPIRED_GRACE_SECONDS < now) return null;
    }
    return claims;
  } catch {
    return null;
  }
}
