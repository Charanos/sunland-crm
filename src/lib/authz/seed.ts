import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { permissions, roles, rolePermissions, userRoles } from "@/db/schema";
import { PERMISSION_CATALOG, SYSTEM_ROLES } from "@/lib/authz/catalog";

/**
 * Idempotent: safe to run on every deploy/seed. System roles are declarative —
 * their role_permissions are fully replaced from SYSTEM_ROLES each run, so the
 * catalog in code is always the source of truth (an API-side edit to a system
 * role's permissions would otherwise silently vanish on the next seed).
 */
export async function seedPermissionCatalog() {
  for (const p of PERMISSION_CATALOG) {
    await db
      .insert(permissions)
      .values(p)
      .onConflictDoUpdate({
        target: permissions.key,
        set: { module: p.module, resource: p.resource, action: p.action, description: p.description },
      });
  }

  for (const roleDef of SYSTEM_ROLES) {
    const [role] = await db
      .insert(roles)
      .values({ slug: roleDef.slug, name: roleDef.name, isSystem: true, scopeType: roleDef.scopeType })
      .onConflictDoUpdate({
        target: roles.slug,
        set: { name: roleDef.name, isSystem: true, scopeType: roleDef.scopeType },
      })
      .returning();

    const permRows =
      roleDef.permissions.length > 0
        ? await db.select().from(permissions).where(inArray(permissions.key, roleDef.permissions))
        : [];
    const permIdByKey = new Map(permRows.map((p) => [p.key, p.id]));

    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
    if (roleDef.permissions.length > 0) {
      await db.insert(rolePermissions).values(
        roleDef.permissions.map((key) => ({ roleId: role.id, permissionId: permIdByKey.get(key)! })),
      );
    }
  }
}

/**
 * Grants a role to a user. Checked-then-insert rather than onConflictDoNothing:
 * `entity_id` is nullable and Postgres treats NULL as distinct in unique
 * indexes, so two "global" grants (entityId null) for the same user+role
 * would not be recognized as a conflict and would silently duplicate.
 */
export async function grantUserRole(userId: string, roleSlug: string, entityId: string | null = null) {
  const [role] = await db.select().from(roles).where(eq(roles.slug, roleSlug)).limit(1);
  if (!role) throw new Error(`Unknown role slug: ${roleSlug}`);

  const existing = await db
    .select()
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(userRoles.roleId, role.id),
        entityId ? eq(userRoles.entityId, entityId) : isNull(userRoles.entityId),
      ),
    )
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(userRoles).values({ userId, roleId: role.id, entityId });
}
