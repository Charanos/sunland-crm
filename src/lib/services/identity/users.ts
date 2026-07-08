import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { ConflictError, DomainValidationError, ForbiddenError, NotFoundError } from "@/lib/authz/errors";
import { hashPassword } from "@/lib/auth/password";
import { isLastSuperAdmin } from "@/lib/services/identity/access";
import type { CallerContext } from "@/lib/services/types";
import {
  createUserSchema,
  updateUserAccessSchema,
  updateUserProfileSchema,
} from "@/lib/validation/identity";
import { parseInput } from "@/lib/validation/parse";

const PUBLIC_COLUMNS = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  title: users.title,
  primaryEntityId: users.primaryEntityId,
  isActive: users.isActive,
  lastSignedInAt: users.lastSignedInAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

/** Always entity-filtered — consistent with every other module's scopeEntityFilter reads. */
export async function listUsers(ctx: CallerContext, filters: { entityId?: string } = {}) {
  const entityId = filters.entityId ?? ctx.entityId;
  if (!entityId) throw new DomainValidationError("entityId is required");
  await authorize(ctx, "identity.user.read", entityId);

  return db.select(PUBLIC_COLUMNS).from(users).where(eq(users.primaryEntityId, entityId));
}

export async function getUser(ctx: CallerContext, userId: string) {
  const [target] = await db.select(PUBLIC_COLUMNS).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new NotFoundError("User not found");

  // Anyone may fetch their own record (self-service profile read); viewing
  // someone else's requires identity.user.read scoped to their entity.
  if (target.id !== ctx.user.id) {
    await authorize(ctx, "identity.user.read", target.primaryEntityId ?? ctx.entityId);
  }

  return target;
}

/** Self-service only — name/title. Never role/status/entity (that's updateUserAccess). */
export async function updateUserProfile(ctx: CallerContext, userId: string, rawInput: unknown) {
  if (userId !== ctx.user.id) {
    throw new ForbiddenError("You may only edit your own profile");
  }
  const input = parseInput(updateUserProfileSchema, rawInput);

  return db.transaction(async (tx) => {
    const [before] = await tx.select(PUBLIC_COLUMNS).from(users).where(eq(users.id, userId)).limit(1);
    if (!before) throw new NotFoundError("User not found");

    const [after] = await tx.update(users).set(input).where(eq(users.id, userId)).returning(PUBLIC_COLUMNS);

    await writeAudit(tx, ctx, {
      action: "identity.user.update_profile",
      associatedType: "user",
      associatedId: userId,
      summary: `${ctx.user.name} updated their profile`,
      entityId: before.primaryEntityId,
      before,
      after,
    });

    return after;
  });
}

/**
 * Staff-only — role/isActive/primaryEntityId. This is the actual
 * permission-escalation-adjacent surface (changing `role` changes default
 * portal routing; isActive gates login entirely), so it's blocked from ever
 * deactivating the last active CEO (isLastSuperAdmin).
 */
export async function updateUserAccess(ctx: CallerContext, userId: string, rawInput: unknown) {
  const input = parseInput(updateUserAccessSchema, rawInput);

  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new NotFoundError("User not found");

  await authorize(ctx, "identity.user.write", target.primaryEntityId ?? ctx.entityId);

  if (input.isActive === false && (await isLastSuperAdmin(userId))) {
    throw new ConflictError("Cannot deactivate the last active CEO account");
  }

  return db.transaction(async (tx) => {
    const [after] = await tx
      .update(users)
      .set(input as Partial<typeof users.$inferInsert>)
      .where(eq(users.id, userId))
      .returning(PUBLIC_COLUMNS);

    await writeAudit(tx, ctx, {
      action: "identity.user.update_access",
      associatedType: "user",
      associatedId: userId,
      summary: `${ctx.user.name} updated access for ${target.name}`,
      entityId: target.primaryEntityId,
      before: target,
      after,
    });

    return after;
  });
}

/**
 * No email service exists yet (checked — none configured), so this returns
 * a one-time plaintext temporary password for the admin to relay out-of-band,
 * rather than building a speculative invite/reset-token flow that isn't
 * needed for anything else in the system today.
 */
export async function createUser(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(createUserSchema, rawInput);
  await authorize(ctx, "identity.user.write", input.primaryEntityId);

  const temporaryPassword = randomBytes(9).toString("base64url");
  const passwordHash = await hashPassword(temporaryPassword);

  const created = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: input.email,
        passwordHash,
        name: input.name,
        role: input.role as (typeof users.$inferInsert)["role"],
        title: input.title,
        primaryEntityId: input.primaryEntityId,
      })
      .returning(PUBLIC_COLUMNS);

    await writeAudit(tx, ctx, {
      action: "identity.user.create",
      associatedType: "user",
      associatedId: user.id,
      summary: `${ctx.user.name} created a new user account for ${user.name}`,
      entityId: input.primaryEntityId,
      after: user,
    });

    return user;
  });

  return { user: created, temporaryPassword };
}
