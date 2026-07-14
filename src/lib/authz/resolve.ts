import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { permissions, rolePermissions, roles, userRoles } from "@/db/schema";
import type { CallerContext } from "@/lib/authz/context";

// Keyed on the ctx object reference itself, which is created once per request -
// this gives real per-request caching (multiple authorize() calls in one
// handler share a query) without risking stale entitlements leaking across
// requests/warm serverless instances the way a module-level Map keyed by
// user id would. Nested by scope key because a single request can legitimately
// authorize against more than one entity scope (e.g. deciding an approval
// scoped to the *resource's* entity, which is only known after it's loaded -
// never trust a client-supplied entity_id, per backend master §4).
const permissionCache = new WeakMap<CallerContext, Map<string, Set<string>>>();
const ANY_SCOPE = "__any__";

/**
 * `entityId`:
 * - a real entity id → grants scoped globally (null) OR to that entity apply.
 * - `null` → **no entity filter at all**: does this user hold the permission
 *   in ANY capacity, anywhere. Correct for genuinely entity-independent
 *   actions (browsing the role/permission catalog, managing your own
 *   sessions) where the resource has no entity dimension to check against -
 *   passing a fake/empty string here previously crashed Postgres (a uuid
 *   column compared to `""`) and was the root cause of several P0 bugs only
 *   surfaced by real HTTP end-to-end testing, not direct service calls.
 */
export async function resolveActorPermissions(
  ctx: CallerContext,
  entityId: string | null | undefined = ctx.entityId,
): Promise<Set<string>> {
  let perEntity = permissionCache.get(ctx);
  if (!perEntity) {
    perEntity = new Map();
    permissionCache.set(ctx, perEntity);
  }

  const scopeKey = entityId ?? ANY_SCOPE;
  const cached = perEntity.get(scopeKey);
  if (cached) return cached;

  const conditions = [eq(userRoles.userId, ctx.user.id)];
  if (entityId === "group") {
    // "group" represents Sunland HQ / Global context. Only global grants apply.
    conditions.push(isNull(userRoles.entityId));
  } else if (entityId) {
    // Global-scope role grants (entityId null) apply everywhere; entity-scoped
    // grants only apply when they match the entity being acted on.
    conditions.push(or(isNull(userRoles.entityId), eq(userRoles.entityId, entityId))!);
  }

  const rows = await db
    .select({ key: permissions.key })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(...conditions));

  const granted = new Set(rows.map((row) => row.key));
  perEntity.set(scopeKey, granted);
  return granted;
}
