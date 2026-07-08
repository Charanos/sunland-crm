import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { permissions, roles, rolePermissions, userRoles } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { ConflictError, NotFoundError } from "@/lib/authz/errors";
import type { CallerContext } from "@/lib/services/types";
import {
  createRoleSchema,
  updateRolePermissionsSchema,
} from "@/lib/validation/identity";
import { parseInput } from "@/lib/validation/parse";

/** Roles/permissions are global catalog data, not entity-scoped rows — `null`
 * means "check if the caller holds this permission in any capacity, anywhere"
 * (resolve.ts's ANY_SCOPE), the correct semantic for a resource with no entity. */
export async function listRoles(ctx: CallerContext) {
  await authorize(ctx, "identity.role.read", null);
  return db.select().from(roles);
}

export async function listPermissions(ctx: CallerContext) {
  await authorize(ctx, "identity.role.read", null);
  return db.select().from(permissions);
}

export async function listRolePermissions(ctx: CallerContext, roleId: string) {
  await authorize(ctx, "identity.role.read", null);
  return db
    .select({ key: permissions.key })
    .from(rolePermissions)
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(rolePermissions.roleId, roleId));
}

/** Custom (non-system) roles only — system roles are declarative, seeded from catalog.ts. */
export async function createRole(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(createRoleSchema, rawInput);
  await authorize(ctx, "identity.role.write", null);

  const permRows =
    input.permissions.length > 0
      ? await db.select().from(permissions).where(inArray(permissions.key, input.permissions))
      : [];

  return db.transaction(async (tx) => {
    const [role] = await tx
      .insert(roles)
      .values({ slug: input.slug, name: input.name, isSystem: false, scopeType: input.scopeType })
      .returning();

    if (permRows.length > 0) {
      await tx
        .insert(rolePermissions)
        .values(permRows.map((p) => ({ roleId: role.id, permissionId: p.id })));
    }

    await writeAudit(tx, ctx, {
      action: "identity.role.create",
      associatedType: "role",
      associatedId: role.id,
      summary: `${ctx.user.name} created role "${role.name}"`,
      entityId: null,
      after: { ...role, permissions: input.permissions },
    });

    return role;
  });
}

async function loadEditableRole(roleId: string) {
  const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!role) throw new NotFoundError("Role not found");
  if (role.isSystem) {
    // seedPermissionCatalog() fully replaces role_permissions for system
    // roles on every reseed — an API-side edit here would silently vanish
    // on the next deploy, so it's rejected outright rather than pretending to work.
    throw new ConflictError("System roles are managed by the seeded permission catalog, not the API");
  }
  return role;
}

export async function updateRolePermissions(ctx: CallerContext, roleId: string, rawInput: unknown) {
  const input = parseInput(updateRolePermissionsSchema, rawInput);
  const role = await loadEditableRole(roleId);
  await authorize(ctx, "identity.role.write", null);

  const before = await listRolePermissions(ctx, roleId);

  const permRows =
    input.permissions.length > 0
      ? await db.select().from(permissions).where(inArray(permissions.key, input.permissions))
      : [];

  return db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    if (permRows.length > 0) {
      await tx
        .insert(rolePermissions)
        .values(permRows.map((p) => ({ roleId, permissionId: p.id })));
    }

    await writeAudit(tx, ctx, {
      action: "identity.role.update_permissions",
      associatedType: "role",
      associatedId: roleId,
      summary: `${ctx.user.name} updated permissions for role "${role.name}"`,
      entityId: null,
      before: { permissions: before.map((p) => p.key) },
      after: { permissions: input.permissions },
    });

    return { roleId, permissions: input.permissions };
  });
}

export async function deleteRole(ctx: CallerContext, roleId: string) {
  const role = await loadEditableRole(roleId);
  await authorize(ctx, "identity.role.write", null);

  // userRoles.roleId cascades on delete — block first rather than silently
  // stripping the role from everyone still holding it.
  const grants = await db.select().from(userRoles).where(eq(userRoles.roleId, roleId));
  if (grants.length > 0) {
    throw new ConflictError(`Role is still assigned to ${grants.length} user(s); revoke it from them first`);
  }

  return db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    await tx.delete(roles).where(eq(roles.id, roleId));

    await writeAudit(tx, ctx, {
      action: "identity.role.delete",
      associatedType: "role",
      associatedId: roleId,
      summary: `${ctx.user.name} deleted role "${role.name}"`,
      entityId: null,
      before: role,
    });

    return { deleted: true };
  });
}
