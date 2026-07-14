import { randomBytes, randomUUID, createHash } from "crypto";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import type { UserRole } from "@/types";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

const cookieName = "sunland_session";
const DEFAULT_EXPIRY = "7d";

function getSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is required for session operations");
  }

  return new TextEncoder().encode(secret);
}

/** Parses jose's duration shorthand ("7d", "12h", "30m", "45s") into milliseconds. */
function parseExpiryMs(expiry: string): number {
  const match = expiry.trim().match(/^(\d+)\s*(s|m|h|d)?$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // fall back to 7 days on an unrecognized format
  const value = Number(match[1]);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]?.toLowerCase() ?? "s"] ?? 1000;
  return value * unitMs;
}

function hashJti(jti: string): string {
  return createHash("sha256").update(jti).digest("hex");
}

export async function createSessionToken(user: SessionUser, jti: string) {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRY ?? DEFAULT_EXPIRY)
    .sign(getSecret());
}

export type SessionMetadata = { ip?: string; userAgent?: string };

/**
 * Signs a session JWT and records a matching `sessions` row (backend master
 * §3.2) so the session is listable and revocable - the JWT alone can never be
 * "unsigned" once issued, so revocation requires this side channel.
 */
export async function setSession(user: SessionUser, metadata: SessionMetadata = {}) {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + parseExpiryMs(process.env.JWT_EXPIRY ?? DEFAULT_EXPIRY));

  await db.insert(sessions).values({
    id: jti,
    userId: user.id,
    tokenHash: hashJti(jti),
    expiresAt,
    ip: metadata.ip,
    userAgent: metadata.userAgent,
  });

  const token = await createSessionToken(user, jti);
  const cookieStore = await cookies();

  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

/** Revokes the current session (if any) and clears the cookie - real sign-out. */
export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;

  if (token && process.env.JWT_SECRET) {
    try {
      const { payload } = await jwtVerify(token, getSecret());
      if (typeof payload.jti === "string") {
        await db
          .update(sessions)
          .set({ revokedAt: new Date() })
          .where(eq(sessions.tokenHash, hashJti(payload.jti)));
      }
    } catch {
      // Token already invalid/expired - nothing to revoke, just clear the cookie below.
    }
  }

  cookieStore.delete(cookieName);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  if (process.env.SUNLAND_AUTH_BYPASS === "true") {
    const ceo = await db.query.users.findFirst({ where: eq(users.role, "ceo") });
    if (ceo) {
      return {
        id: ceo.id,
        email: ceo.email,
        name: ceo.name,
        role: "ceo",
      };
    }
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;

  if (!token || !process.env.JWT_SECRET) {
    return null;
  }

  try {
    const result = await jwtVerify(token, getSecret());
    const user = result.payload.user as SessionUser | undefined;
    const jti = result.payload.jti;
    if (!user || typeof jti !== "string") return null;

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, hashJti(jti)))
      .limit(1);

    // No matching row (pre-dates this feature), revoked, or expired - treat as signed out.
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

/** Not currently used by setSession (which generates its own), exported for tests/tools. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}
