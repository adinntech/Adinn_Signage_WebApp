import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { verifySessionToken } from "@/lib/session-token";
import { canAccessPath } from "@/lib/role-routes";

/**
 * Server-side page guard. A page opens only with a token the API signed (cookie `sg_session`, kept in step with
 * the in-memory token by /session). No token: login. Wrong role for the area: back to the dashboard.
 * An already signed-in person opening /login goes straight in. The API still checks the token on every call.
 */
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password"];
const isPublic = (p: string) => PUBLIC_PATHS.some((x) => p === x || p.startsWith(x + "/"));

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    // Without the secret the server cannot check tokens. Production refuses; development falls back to the client guard.
    if (process.env.NODE_ENV === "production") return new NextResponse("Server auth is not configured", { status: 500 });
    return NextResponse.next();
  }

  const claims = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, secret, true);

  if (isPublic(pathname)) {
    // Skip when the app sent the person here (`next` / `reason`): their session just failed, so do not bounce them back.
    const sentHere = req.nextUrl.searchParams.has("next") || req.nextUrl.searchParams.has("reason");
    if (claims && !sentHere && pathname === "/login") return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.next();
  }

  if (!claims) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    const res = NextResponse.redirect(url);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  if (!canAccessPath(claims.role, pathname)) return NextResponse.redirect(new URL("/dashboard", req.url));
  return NextResponse.next();
}

export const config = {
  // Everything except the session endpoint, Next internals and files in /public.
  matcher: ["/((?!session|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|js|json|webmanifest|txt)$).*)"],
};
