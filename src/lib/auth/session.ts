import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import type { UserRole } from "@/types";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

const cookieName = "sunland_session";

function getSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is required for session operations");
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRY ?? "7d")
    .sign(getSecret());
}

export async function setSession(user: SessionUser) {
  const token = await createSessionToken(user);
  const cookieStore = await cookies();

  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;

  if (!token || !process.env.JWT_SECRET) {
    return null;
  }

  try {
    const result = await jwtVerify(token, getSecret());
    const user = result.payload.user as SessionUser | undefined;
    return user ?? null;
  } catch {
    return null;
  }
}
