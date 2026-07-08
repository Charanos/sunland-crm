import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { roles, userRoles, users } from "@/db/schema";

/**
 * True if `userId` is the sole remaining active holder of the "ceo" role —
 * the guard that keeps CEO dominion from being accidentally locked out
 * (portal doc §6: "CEO holds every permission... real dominion over
 * role/permission escalation"). Checked before deactivating an account or
 * revoking a CEO role grant, never before routine edits.
 */
export async function isLastSuperAdmin(userId: string): Promise<boolean> {
  const holders = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(users, eq(userRoles.userId, users.id))
    .where(and(eq(roles.slug, "ceo"), eq(users.isActive, true)));

  const distinctHolderIds = new Set(holders.map((row) => row.userId));
  return distinctHolderIds.size === 1 && distinctHolderIds.has(userId);
}
