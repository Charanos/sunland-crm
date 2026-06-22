import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { canAccess, getDefaultPortal } from "./src/lib/auth/roles";
import type { UserRole } from "./src/types";

const protectedPrefixes = ["/admin", "/ops", "/fin", "/hr"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.SUNLAND_AUTH_BYPASS !== "false"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("sunland_session")?.value;
  const secret = process.env.JWT_SECRET;

  if (!token || !secret) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const user = payload.user as { role: UserRole } | undefined;
    if (!user || !user.role) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("sunland_session");
      return response;
    }

    if (!canAccess(user.role, pathname)) {
      const portal = getDefaultPortal(user.role);
      return NextResponse.redirect(new URL(portal, request.url));
    }

    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("sunland_session");
    return response;
  }
}

export const config = {
  matcher: ["/admin/:path*", "/ops/:path*", "/fin/:path*", "/hr/:path*"],
};
