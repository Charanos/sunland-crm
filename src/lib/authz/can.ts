import { ForbiddenError } from "@/lib/authz/errors";
import { resolveActorPermissions } from "@/lib/authz/resolve";
import type { CallerContext } from "@/lib/authz/context";

/**
 * `entityId` defaults to the caller's active scope (ctx.entityId) but can be
 * overridden to the entity a specific resource belongs to — required when
 * that entity is only known after loading the resource (e.g. deciding an
 * approval request), since it must never be taken from client input.
 */
export async function can(ctx: CallerContext, permissionKey: string, entityId?: string | null): Promise<boolean> {
  const granted = await resolveActorPermissions(ctx, entityId);
  return granted.has(permissionKey);
}

/** Action-level authorization — throws ForbiddenError, never returns false. */
export async function authorize(ctx: CallerContext, permissionKey: string, entityId?: string | null): Promise<void> {
  const allowed = await can(ctx, permissionKey, entityId);
  if (!allowed) {
    throw new ForbiddenError(`Missing permission: ${permissionKey}`);
  }
}
