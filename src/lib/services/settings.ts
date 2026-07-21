import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";
import { upsertSettingSchema } from "@/lib/validation/settings";
import { parseInput } from "@/lib/validation/parse";

/**
 * Reads a single company-wide (Group entity) setting value for business logic
 * to branch on - thresholds as data, never hardcoded (master doc §5.1). Falls
 * back rather than throwing so a not-yet-seeded environment degrades to the
 * documented default instead of hard-failing the caller's whole operation.
 */
export async function getGroupSettingValue<T>(key: string, fallback: T): Promise<T> {
  const groupEntityId = await resolveEntityId("group");
  const [row] = await db
    .select()
    .from(settings)
    .where(and(eq(settings.entityId, groupEntityId), eq(settings.key, key)))
    .limit(1);
  return row ? (row.value as T) : fallback;
}

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
      .where(and(eq(settings.entityId, input.entityId), eq(settings.key, input.key)))
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
 * Real threshold values - the P0 design's whole point was "thresholds as
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

  // ── Executive Dashboard Spec §6.2 - Consolidated Approval Authority Table.
  // Additive to the four keys above (kept untouched for compatibility with
  // existing readers); each row below maps 1:1 to a table row. GM/CEO figures
  // are the only ones ever edited from System Administration (spec §8.3, CEO
  // only) - the two existing generic petty-cash keys above stay as the
  // legacy single-threshold reading some code may still use, while these
  // split property vs. office as the table actually specifies.
  {
    key: "property_petty_cash_auto_approve_kes",
    value: 5000,
    description: "Property petty-cash expense auto-approved below this amount, no approval routing needed",
  },
  {
    key: "property_petty_cash_gm_threshold_kes",
    value: 5000,
    description: "Property petty-cash expense requires GM approval from this amount up to the CEO threshold",
  },
  {
    key: "property_petty_cash_ceo_threshold_kes",
    value: 50000,
    description: "Property petty-cash expense above this amount requires CEO approval",
  },
  {
    key: "office_petty_cash_auto_approve_kes",
    value: 10000,
    description: "Office petty-cash expense auto-approved below this amount, no approval routing needed",
  },
  {
    key: "office_petty_cash_gm_threshold_kes",
    value: 10000,
    description: "Office petty-cash expense requires GM approval from this amount up to the CEO threshold",
  },
  {
    key: "office_petty_cash_ceo_threshold_kes",
    value: 50000,
    description: "Office petty-cash expense above this amount requires CEO approval",
  },
  {
    key: "petty_cash_topup_gm_threshold_kes",
    value: 5000,
    description: "Petty-cash top-up requests above this amount require GM approval (spec §8.3 proposed default)",
  },
  {
    key: "petty_cash_topup_ceo_threshold_kes",
    value: 50000,
    description: "Petty-cash top-up requests above this amount require CEO approval (spec §8.3 proposed default)",
  },
  {
    key: "vehicle_request_external_hire_requires_gm",
    value: true,
    description: "External vehicle hire (outside the in-fleet pool) always requires GM approval",
  },
  {
    key: "mandate_activation_ceo_unit_threshold",
    value: 10,
    description: "Mandate activation requires CEO approval above this many units (GM approval is always required)",
  },
  {
    key: "mandate_activation_ceo_annual_value_kes",
    value: 5000000,
    description: "Mandate activation requires CEO approval above this annualized collectible value",
  },
  {
    key: "mandate_letter_ceo_policy_exceeds",
    value: true,
    description: "Mandate letter requires CEO approval whenever its value or term exceeds standing policy",
  },
  {
    key: "payroll_disbursement_requires_gm",
    value: true,
    description: "Payroll disbursement always requires GM approval; CEO visibility is informational only",
  },
  {
    key: "promotion_demotion_head_level_requires_ceo",
    value: true,
    description: "Promotions/demotions into or out of a Head-level role require CEO approval; other roles require GM",
  },
  {
    key: "bankers_cheque_dual_signoff_threshold_kes",
    value: 500000,
    description: "Banker's cheques above this amount require dual sign-off with the Finance Head before crediting",
  },
  {
    key: "agent_commission_payout_requires_ceo",
    value: true,
    description: "Agent commission payouts and deal approvals always require CEO sign-off, never auto-approved",
  },
  {
    key: "offboarding_head_level_notifies_ceo",
    value: true,
    description: "Offboarding a Head-level role notifies the CEO; treated as effectively required sign-off",
  },

  // ── Maintenance module (property lifecycle unification follow-up).
  // Response-time targets by priority + cost-approval tiers, the same
  // "thresholds as data" pattern as everything above. Hour defaults are a
  // proposed starting point derived from the Maintenance Board design
  // reference, not a confirmed business number - CEO can edit from System
  // Administration like every other threshold here.
  {
    key: "maintenance_sla_hours_critical",
    value: 6,
    description: "Target hours to resolve a critical-severity maintenance request before it's flagged breached",
  },
  {
    key: "maintenance_sla_hours_urgent",
    value: 24,
    description: "Target hours to resolve an urgent-severity maintenance request before it's flagged breached",
  },
  {
    key: "maintenance_sla_hours_routine",
    value: 72,
    description: "Target hours to resolve a routine-severity maintenance request before it's flagged breached",
  },
  {
    key: "maintenance_cost_gm_threshold_kes",
    value: 25000,
    description: "Maintenance work order cost above this amount (and above the property mandate's own authority) requires GM approval",
  },
  {
    key: "maintenance_cost_ceo_threshold_kes",
    value: 100000,
    description: "Maintenance work order cost above this amount requires CEO approval",
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
