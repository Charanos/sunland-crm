import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError } from "@/lib/authz/errors";
import type { CallerContext } from "@/lib/services/types";
import { upsertSettingSchema } from "@/lib/validation/settings";
import { parseInput } from "@/lib/validation/parse";

export async function getSettings(ctx: CallerContext, entityId?: string) {
  const targetEntityId = entityId ?? ctx.entityId;
  if (!targetEntityId) throw new DomainValidationError("entityId is required");
  await authorize(ctx, "settings.entity.read", targetEntityId);
  return db.select().from(settings).where(eq(settings.entityId, targetEntityId));
}

export async function upsertSetting(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(upsertSettingSchema, rawInput);
  await authorize(ctx, "settings.entity.write", input.entityId);

  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(settings)
      .where(eq(settings.entityId, input.entityId))
      .limit(1);

    const [after] = await tx
      .insert(settings)
      .values({
        entityId: input.entityId,
        key: input.key,
        value: input.value,
        description: input.description,
      })
      .onConflictDoUpdate({
        target: [settings.entityId, settings.key],
        set: { value: input.value, description: input.description },
      })
      .returning();

    await writeAudit(tx, ctx, {
      action: "settings.entity.upsert",
      associatedType: "setting",
      associatedId: after.id,
      summary: `${ctx.user.name} updated setting "${input.key}"`,
      entityId: input.entityId,
      before: before ?? null,
      after,
    });

    return after;
  });
}

/**
 * Real threshold values — the P0 design's whole point was "thresholds as
 * data, never hardcoded" (backend master §5.1); this is what actually
 * populates that promise. Company-wide, so seeded under the Group entity;
 * revamp guide §4 is the source for each value.
 */
export const DEFAULT_SETTINGS: Array<{ key: string; value: unknown; description: string }> = [
  {
    key: "cheque_hold_threshold_kes",
    value: 500000,
    description: "Banker's cheques above this amount require GM/CEO approval before crediting",
  },
  {
    key: "petty_cash_approval_threshold_kes",
    value: 5000,
    description: "Property/office petty-cash expenses above this amount require GM approval",
  },
  {
    key: "mandate_unit_approval_threshold",
    value: 10,
    description: "Mandates covering more units than this require GM sign-off before activation",
  },
  {
    key: "mandate_default_rate",
    value: 0.1,
    description: "Default management-fee rate for a new mandate; a different rate requires justification",
  },
];

export async function seedDefaultSettings(groupEntityId: string) {
  for (const setting of DEFAULT_SETTINGS) {
    await db
      .insert(settings)
      .values({ entityId: groupEntityId, key: setting.key, value: setting.value, description: setting.description })
      .onConflictDoUpdate({
        target: [settings.entityId, settings.key],
        set: { value: setting.value, description: setting.description },
      });
  }
}
