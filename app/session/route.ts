import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { verifySessionToken } from "@/lib/session-token";

/**
 * Keeps the web origin's copy of the signed-in token (httpOnly cookie) in step with the one the browser holds
 * in memory, so the proxy can guard pages on the server. Called after login, register and every silent refresh.
 * Only a token the API signed is accepted, so nobody can plant a cookie of their own.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { accessToken?: string; remember?: boolean } | null;
  const claims = await verifySessionToken(body?.accessToken, process.env.JWT_ACCESS_SECRET);
  if (!claims || !body?.accessToken) return NextResponse.json({ ok: false }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, body.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Without "remember me" this is a browser-session cookie, like the refresh cookie.
    ...(body.remember === false ? {} : { maxAge: 30 * 86400 }),
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
