import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { ConflictError, NotFoundError } from "@/lib/authz/errors";
import type { CallerContext } from "@/lib/services/types";

const SAFE_COLUMNS = {
  id: sessions.id,
  userId: sessions.userId,
  expiresAt: sessions.expiresAt,
  ip: sessions.ip,
  userAgent: sessions.userAgent,
  revokedAt: sessions.revokedAt,
  createdAt: sessions.createdAt,
}; // deliberately excludes tokenHash

/** Own sessions need no permission; someone else's requires identity.session.read. */
export async function listSessions(ctx: CallerContext, targetUserId?: string) {
  const userId = targetUserId ?? ctx.user.id;
  if (userId !== ctx.user.id) {
    await authorize(ctx, "identity.session.read", null);
  }

  return db
    .select(SAFE_COLUMNS)
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt));
}

/** Own session revocation (sign out a device) needs no permission; revoking
 * someone else's (e.g. a compromised account) requires identity.session.revoke. */
export async function revokeSession(ctx: CallerContext, sessionId: string) {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!session) throw new NotFoundError("Session not found");

  if (session.userId !== ctx.user.id) {
    await authorize(ctx, "identity.session.revoke", null);
  }

  if (session.revokedAt) {
    throw new ConflictError("Session is already revoked");
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, sessionId))
      .returning(SAFE_COLUMNS);

    await writeAudit(tx, ctx, {
      action: "identity.session.revoke",
      associatedType: "session",
      associatedId: sessionId,
      summary:
        session.userId === ctx.user.id
          ? `${ctx.user.name} signed out a device`
          : `${ctx.user.name} revoked a session for another user`,
      entityId: null,
      before: { revokedAt: null },
      after: { revokedAt: updated.revokedAt },
    });

    return updated;
  });
}

/**
 * "Sign out all other devices" (Account console → Security). Revokes every
 * one of the caller's own live sessions except the current one - no
 * permission needed (own account). `currentSessionId` is the JWT jti of this
 * request, so the device the CEO is looking at stays signed in.
 */
export async function revokeAllOtherSessions(ctx: CallerContext, currentSessionId: string | null) {
  return db.transaction(async (tx) => {
    const conditions = [eq(sessions.userId, ctx.user.id), isNull(sessions.revokedAt)];
    if (currentSessionId) conditions.push(ne(sessions.id, currentSessionId));

    const revoked = await tx
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(...conditions))
      .returning({ id: sessions.id });

    if (revoked.length > 0) {
      await writeAudit(tx, ctx, {
        action: "identity.session.revoke_all",
        associatedType: "user",
        associatedId: ctx.user.id,
        summary: `${ctx.user.name} signed out ${revoked.length} other device${revoked.length === 1 ? "" : "s"}`,
        entityId: null,
        after: { revokedCount: revoked.length },
      });
    }

    return { revokedCount: revoked.length };
  });
}
