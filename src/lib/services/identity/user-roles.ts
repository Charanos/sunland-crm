import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { roles, userRoles, users } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { ConflictError, NotFoundError } from "@/lib/authz/errors";
import { isLastSuperAdmin } from "@/lib/services/identity/access";
import type { CallerContext } from "@/lib/services/types";
import { grantRoleSchema } from "@/lib/validation/identity";
import { parseInput } from "@/lib/validation/parse";

/** Grants a role to a user — the actual permission-escalation control surface. */
export async function grantUserRole(ctx: CallerContext, userId: string, rawInput: unknown) {
  const input = parseInput(grantRoleSchema, rawInput);
  const entityId = input.entityId ?? null;

  // entityId may be deliberately null (a global grant) — never substitute
  // ctx.entityId here, that would silently check the wrong scope.
  await authorize(ctx, "identity.role.write", entityId);

  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new NotFoundError("User not found");

  const [role] = await db.select().from(roles).where(eq(roles.id, input.roleId)).limit(1);
  if (!role) throw new NotFoundError("Role not found");

  // Nullable-safe existence check done in JS (Postgres treats NULL as
  // distinct in equality, so a SQL eq(entityId, null) wouldn't match).
  const existing = await db
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, input.roleId)));
  const alreadyGranted = existing.some((row) => row.entityId === entityId);
  if (alreadyGranted) {
    throw new ConflictError("User already holds this role at this scope");
  }

  return db.transaction(async (tx) => {
    const [grant] = await tx
      .insert(userRoles)
      .values({ userId, roleId: input.roleId, entityId })
      .returning();

    await writeAudit(tx, ctx, {
      action: "identity.role.grant",
      associatedType: "user_role",
      associatedId: grant.id,
      summary: `${ctx.user.name} granted role "${role.name}" to ${target.name}`,
      entityId,
      after: grant,
    });

    return grant;
  });
}

export async function revokeUserRole(ctx: CallerContext, userRoleId: string) {
  const [grant] = await db.select().from(userRoles).where(eq(userRoles.id, userRoleId)).limit(1);
  if (!grant) throw new NotFoundError("Role grant not found");

  const [role] = await db.select().from(roles).where(eq(roles.id, grant.roleId)).limit(1);
  if (!role) throw new NotFoundError("Role not found");

  await authorize(ctx, "identity.role.write", grant.entityId);

  if (role.slug === "ceo" && (await isLastSuperAdmin(grant.userId))) {
    throw new ConflictError("Cannot revoke the CEO role from the last active CEO");
  }

  return db.transaction(async (tx) => {
    await tx.delete(userRoles).where(eq(userRoles.id, userRoleId));

    await writeAudit(tx, ctx, {
      action: "identity.role.revoke",
      associatedType: "user_role",
      associatedId: userRoleId,
      summary: `${ctx.user.name} revoked role "${role.name}"`,
      entityId: grant.entityId,
      before: grant,
    });

    return { revoked: true };
  });
}
