import { generateSecret, generateURI, verify as verifyTotp } from "otplib";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, sessions, users } from "@/db/schema";
import { writeAudit } from "@/lib/authz/audit";
import { ConflictError, DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { CallerContext } from "@/lib/services/types";
import { parseInput } from "@/lib/validation/parse";
import { changePasswordSchema, totpVerifySchema } from "@/lib/validation/identity";

const TOTP_ISSUER = "Sunland ERP";

/**
 * Pure, DB-free security-score calculation so it stays identical wherever it's
 * shown (Console Pulse gauge + Security posture card) and is unit-testable.
 * Mirrors the design's own weighting: 2FA is the biggest lever, a fresh
 * password helps, too many live sessions is a small risk.
 */
export function computeSecurityScore(input: { twofaEnabled: boolean; passwordAgeDays: number | null; activeSessionCount: number }): {
  pct: number;
  label: "Strong" | "Fair" | "At risk";
} {
  let score = input.twofaEnabled ? 45 : 10;
  // Password freshness: full marks under 90 days, decaying after.
  if (input.passwordAgeDays == null) score += 15;
  else if (input.passwordAgeDays <= 90) score += 30;
  else if (input.passwordAgeDays <= 180) score += 18;
  else score += 6;
  score += Math.max(0, 20 - Math.max(0, input.activeSessionCount - 1) * 4);
  const pct = Math.min(96, score);
  const label = pct >= 80 ? "Strong" : pct >= 55 ? "Fair" : "At risk";
  return { pct, label };
}

function daysSince(date: Date | null): number | null {
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

/** Everything the Security section needs in one call: posture, 2FA/password state, access log. */
export async function getSecurityOverview(ctx: CallerContext) {
  const [user] = await db
    .select({ id: users.id, name: users.name, passwordChangedAt: users.passwordChangedAt, totpEnabledAt: users.totpEnabledAt, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, ctx.user.id))
    .limit(1);
  if (!user) throw new NotFoundError("User not found");

  const liveSessions = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.userId, ctx.user.id), isNull(sessions.revokedAt)));

  const twofaEnabled = !!user.totpEnabledAt;
  // Fall back to account-creation date as the "password age" baseline when the
  // user has never explicitly changed it (honest, not a fabricated recency).
  const passwordAgeDays = daysSince(user.passwordChangedAt ?? user.createdAt ?? null);
  const score = computeSecurityScore({ twofaEnabled, passwordAgeDays, activeSessionCount: liveSessions.length });

  // Real access log: this user's own security-relevant audit rows. Queried
  // directly by actorId (not via the entity-scoped listAuditLog) because auth
  // events like login are entity-independent (entityId null) and inherently
  // user-scoped - a user always sees their own security activity.
  const SECURITY_ACTIONS = [
    "auth.login",
    "auth.password_change",
    "identity.session.revoke",
    "identity.session.revoke_all",
    "identity.security.2fa_enabled",
    "identity.security.2fa_disabled",
    "identity.user.update_profile",
  ];
  const accessLog = await db
    .select({ id: activityLogs.id, action: activityLogs.action, summary: activityLogs.summary, createdAt: activityLogs.createdAt })
    .from(activityLogs)
    .where(and(eq(activityLogs.actorId, ctx.user.id), inArray(activityLogs.action, SECURITY_ACTIONS)))
    .orderBy(desc(activityLogs.createdAt))
    .limit(8);

  return {
    scorePct: score.pct,
    scoreLabel: score.label,
    twofaEnabled,
    twofaEnabledAt: user.totpEnabledAt,
    passwordAgeDays,
    activeSessionCount: liveSessions.length,
    accessLog,
  };
}

/** Real self-service password change: verify current → rehash → stamp age → sign out other devices. */
export async function changePassword(ctx: CallerContext, currentSessionId: string | null, rawInput: unknown) {
  const input = parseInput(changePasswordSchema, rawInput);
  if (input.currentPassword === input.newPassword) {
    throw new DomainValidationError("New password must differ from the current one.");
  }

  const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
  if (!user) throw new NotFoundError("User not found");

  const ok = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!ok) throw new DomainValidationError("Your current password is incorrect.");

  const newHash = await hashPassword(input.newPassword);

  return db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: newHash, passwordChangedAt: new Date() }).where(eq(users.id, ctx.user.id));

    // Rotating the password ends every other live session (a real security
    // property, not a nicety) - keep only the device making the change.
    const conditions = [eq(sessions.userId, ctx.user.id), isNull(sessions.revokedAt)];
    const revoked = await tx
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(...conditions))
      .returning({ id: sessions.id });
    // Re-activate the current device so the CEO isn't logged out mid-change.
    if (currentSessionId) {
      await tx.update(sessions).set({ revokedAt: null }).where(eq(sessions.id, currentSessionId));
    }

    await writeAudit(tx, ctx, {
      action: "auth.password_change",
      associatedType: "user",
      associatedId: ctx.user.id,
      summary: `${ctx.user.name} changed their password`,
      entityId: null,
      after: { otherSessionsSignedOut: Math.max(0, revoked.length - (currentSessionId ? 1 : 0)) },
    });

    return { success: true };
  });
}

/**
 * TOTP enrollment step 1: generate a secret + otpauth URI for the authenticator
 * app QR. Stored on the user but NOT yet enabled - totpEnabledAt stays null
 * until a code is verified. Re-enrolling before verifying just rotates the
 * pending secret.
 */
export async function enrollTotp(ctx: CallerContext) {
  const [user] = await db.select({ email: users.email, totpEnabledAt: users.totpEnabledAt }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
  if (!user) throw new NotFoundError("User not found");
  if (user.totpEnabledAt) throw new ConflictError("Two-factor authentication is already enabled.");

  const secret = generateSecret();
  await db.update(users).set({ totpSecret: secret }).where(eq(users.id, ctx.user.id));
  const otpauthUrl = generateURI({ issuer: TOTP_ISSUER, label: user.email, secret });
  return { secret, otpauthUrl };
}

/** TOTP enrollment step 2: confirm the 6-digit code, then flip on totpEnabledAt. */
export async function verifyTotpEnrollment(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(totpVerifySchema, rawInput);
  const [user] = await db.select({ totpSecret: users.totpSecret, totpEnabledAt: users.totpEnabledAt }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
  if (!user) throw new NotFoundError("User not found");
  if (user.totpEnabledAt) throw new ConflictError("Two-factor authentication is already enabled.");
  if (!user.totpSecret) throw new DomainValidationError("Start enrollment before verifying a code.");

  const { valid } = await verifyTotp({ secret: user.totpSecret, token: input.code });
  if (!valid) {
    throw new DomainValidationError("That code didn't match. Check your authenticator app and try again.");
  }

  return db.transaction(async (tx) => {
    await tx.update(users).set({ totpEnabledAt: new Date() }).where(eq(users.id, ctx.user.id));
    await writeAudit(tx, ctx, {
      action: "identity.security.2fa_enabled",
      associatedType: "user",
      associatedId: ctx.user.id,
      summary: `${ctx.user.name} enabled two-factor authentication`,
      entityId: null,
    });
    return { success: true };
  });
}

/** Disable 2FA - requires a current valid TOTP code to prevent a hijacked session turning it off. */
export async function disableTotp(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(totpVerifySchema, rawInput);
  const [user] = await db.select({ totpSecret: users.totpSecret, totpEnabledAt: users.totpEnabledAt }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
  if (!user) throw new NotFoundError("User not found");
  if (!user.totpEnabledAt || !user.totpSecret) throw new ConflictError("Two-factor authentication is not enabled.");
  const { valid } = await verifyTotp({ secret: user.totpSecret, token: input.code });
  if (!valid) {
    throw new DomainValidationError("That code didn't match. Enter a current code to disable 2FA.");
  }

  return db.transaction(async (tx) => {
    await tx.update(users).set({ totpSecret: null, totpEnabledAt: null }).where(eq(users.id, ctx.user.id));
    await writeAudit(tx, ctx, {
      action: "identity.security.2fa_disabled",
      associatedType: "user",
      associatedId: ctx.user.id,
      summary: `${ctx.user.name} disabled two-factor authentication`,
      entityId: null,
    });
    return { success: true };
  });
}
