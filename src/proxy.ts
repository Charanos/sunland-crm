/**
 * Next.js 16 Edge Proxy - Route Guards
 *
 * This file (proxy.ts) is the Next.js 16 successor to middleware.ts.
 * In Next.js 16.2+, `proxy.ts` replaces `middleware.ts` as the edge
 * file convention for per-request route guards. It runs on every
 * matching request at the edge BEFORE the response is served.
 *
 * Why proxy.ts and not next.config.ts rewrites?
 * Rewrites in next.config.ts run at build time and cannot inspect
 * cookies or auth tokens. proxy.ts runs at request time and CAN read
 * the session cookie, making it the correct approach for RBAC guards.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import type { UserRole } from "@/types";
import { canAccess, getDefaultPortal } from "@/lib/auth/roles";

// ─── Session ──────────────────────────────────────────────────────────────────

const COOKIE_NAME = "sunland_session";

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Dev fallback: no JWT_SECRET → skip auth (dev-only convenience)
    if (process.env.NODE_ENV === "development") return null;
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return (payload.user as SessionUser) ?? null;
  } catch {
    return null;
  }
}

// ─── Path classification ──────────────────────────────────────────────────────

/** Public paths that never require authentication */
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/emulate",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "?"));
}

function isApiPath(pathname: string): boolean {
  // Allow all /api/* except the protected mutation endpoints handled by the API itself
  return pathname.startsWith("/api/");
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always pass: public auth routes and API routes
  if (isPublicPath(pathname) || isApiPath(pathname)) {
    return NextResponse.next();
  }

  const user = await getSessionUser(request);

  // Not authenticated → redirect to /login, preserving intended destination
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Root "/" → role-based portal
  if (pathname === "/") {
    return NextResponse.redirect(new URL(getDefaultPortal(user.role), request.url));
  }

  // canAccess() already grants universal pages (/admin/profile, /admin/settings, etc.)
  // to ALL authenticated users regardless of role, so no special handling needed here.
  if (!canAccess(user.role, pathname)) {
    const portalUrl = new URL(getDefaultPortal(user.role), request.url);
    portalUrl.searchParams.set("denied", "1");
    return NextResponse.redirect(portalUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /**
     * Match all paths EXCEPT:
     * - Static files (_next/static, _next/image, favicon, logo, public assets)
     * These never need auth checks, so excluding them saves edge invocation cost.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|logo\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
