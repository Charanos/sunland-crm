import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { ForbiddenError } from "@/lib/authz/errors";
import type { CallerContext } from "@/lib/services/types";
import { parseInput } from "@/lib/validation/parse";
import { upsertUserPreferencesSchema } from "@/lib/validation/identity";

// Per-user display preferences (Account console → Preferences). User-scoped,
// self-service only - no permission gate, but a user can only read/write their
// OWN preferences (same pattern as session self-management). Known keys:
// language, dateFmt, accent, density, navMode, topBar, quietHours, digest.

export async function getUserPreferences(ctx: CallerContext, userId: string): Promise<Record<string, unknown>> {
  if (userId !== ctx.user.id) {
    throw new ForbiddenError("You may only read your own preferences");
  }
  const rows = await db
    .select({ key: userPreferences.key, value: userPreferences.value })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));

  const out: Record<string, unknown> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function upsertUserPreferences(ctx: CallerContext, userId: string, rawInput: unknown) {
  if (userId !== ctx.user.id) {
    throw new ForbiddenError("You may only edit your own preferences");
  }
  const input = parseInput(upsertUserPreferencesSchema, rawInput);

  return db.transaction(async (tx) => {
    for (const pref of input.preferences) {
      const [existing] = await tx
        .select({ id: userPreferences.id })
        .from(userPreferences)
        .where(and(eq(userPreferences.userId, userId), eq(userPreferences.key, pref.key)))
        .limit(1);

      if (existing) {
        await tx
          .update(userPreferences)
          .set({ value: pref.value ?? null, updatedAt: new Date() })
          .where(eq(userPreferences.id, existing.id));
      } else {
        await tx.insert(userPreferences).values({ userId, key: pref.key, value: pref.value ?? null });
      }
    }
    return { success: true };
  });
}
