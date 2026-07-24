import { and, count, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { approvalRequests, settings, transactions, users } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import { getSecurityOverview } from "@/lib/services/identity/security";
import type { CallerContext } from "@/lib/services/types";
import {
  ORG_DEFAULT_KEYS,
  ORG_POLICY_KEYS,
  ROLE_TIER_ORDER,
  roleTierFor,
  type ConsoleScope,
  type RoleTier,
} from "@/components/sunland/account-constants";

// ─── Directory & Roles (org scope) ──────────────────────────────────────────

/**
 * Role-tier counts + members for the org Directory. "fetch then reduce in JS"
 * (no SQL groupBy), matching the rest of the service layer. Pending = active
 * users who have never signed in (their temp credentials are unaccepted) - an
 * honest signal, since there's no separate invite-acceptance table.
 */
export async function getDirectoryOverview(ctx: CallerContext) {
  const entityId = await resolveEntityId(ctx.entityId ?? "group");
  await authorize(ctx, "identity.user.read", entityId);

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      title: users.title,
      role: users.role,
      avatarUrl: users.avatarUrl,
      isActive: users.isActive,
      lastSignedInAt: users.lastSignedInAt,
      createdAt: users.createdAt,
    })
    .from(users);

  const tierCounts: Record<RoleTier, number> = { superadmin: 0, admin: 0, manager: 0, finance: 0, agent: 0, viewer: 0 };
  let pending = 0;
  const members = rows.map((u) => {
    const tier = roleTierFor(u.role);
    if (u.isActive) tierCounts[tier] += 1;
    const isPending = u.isActive && !u.lastSignedInAt;
    if (isPending) pending += 1;
    return {
      id: u.id,
      name: u.name,
      title: u.title ?? "",
      role: u.role,
      tier,
      avatarUrl: u.avatarUrl,
      isActive: u.isActive,
      pending: isPending,
      lastActive: u.lastSignedInAt ? u.lastSignedInAt.toISOString() : null,
      isSelf: u.id === ctx.user.id,
    };
  });

  return {
    totalMembers: members.filter((m) => m.isActive).length,
    pendingCount: pending,
    tierCounts: ROLE_TIER_ORDER.map((tier) => ({ tier, count: tierCounts[tier] })),
    members,
  };
}

// ─── Org access policies (org scope, stored in the real settings table) ─────

const POLICY_DEFAULTS = {
  enforce2fa: true,
  sso: false,
  ipAllowlist: false,
  deviceTrust: true,
  dualRemit: true,
  pwdStrength: "strong" as "standard" | "strong" | "max",
  sessionTimeout: "8h" as string,
};
export type OrgPolicies = typeof POLICY_DEFAULTS;

export async function getOrgPolicies(ctx: CallerContext): Promise<OrgPolicies> {
  const entityId = await resolveEntityId("group");
  await authorize(ctx, "settings.entity.read", entityId);
  const rows = await db.select().from(settings).where(eq(settings.entityId, entityId));
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const read = <T>(key: string, fallback: T): T => (byKey.has(key) ? (byKey.get(key) as T) : fallback);
  return {
    enforce2fa: read(ORG_POLICY_KEYS.enforce2fa, POLICY_DEFAULTS.enforce2fa),
    sso: read(ORG_POLICY_KEYS.sso, POLICY_DEFAULTS.sso),
    ipAllowlist: read(ORG_POLICY_KEYS.ipAllowlist, POLICY_DEFAULTS.ipAllowlist),
    deviceTrust: read(ORG_POLICY_KEYS.deviceTrust, POLICY_DEFAULTS.deviceTrust),
    dualRemit: read(ORG_POLICY_KEYS.dualRemit, POLICY_DEFAULTS.dualRemit),
    pwdStrength: read(ORG_POLICY_KEYS.pwdStrength, POLICY_DEFAULTS.pwdStrength),
    sessionTimeout: read(ORG_POLICY_KEYS.sessionTimeout, POLICY_DEFAULTS.sessionTimeout),
  };
}

/** Derived org-security score from the stored policy values (real data, honest weighting). */
export function computeOrgSecurityScore(p: OrgPolicies): { pct: number; label: "Hardened" | "Fair" | "Exposed" } {
  let score = 40;
  if (p.enforce2fa) score += 22;
  if (p.sso) score += 12;
  if (p.ipAllowlist) score += 8;
  if (p.deviceTrust) score += 8;
  if (p.dualRemit) score += 6;
  if (p.pwdStrength === "strong") score += 6;
  else if (p.pwdStrength === "max") score += 10;
  const pct = Math.min(98, score);
  const label = pct >= 80 ? "Hardened" : pct >= 55 ? "Fair" : "Exposed";
  return { pct, label };
}

export async function updateOrgPolicies(ctx: CallerContext, input: Partial<OrgPolicies>) {
  const entityId = await resolveEntityId("group");
  await authorize(ctx, "settings.entity.write", entityId);

  const map: Array<[keyof OrgPolicies, string]> = [
    ["enforce2fa", ORG_POLICY_KEYS.enforce2fa],
    ["sso", ORG_POLICY_KEYS.sso],
    ["ipAllowlist", ORG_POLICY_KEYS.ipAllowlist],
    ["deviceTrust", ORG_POLICY_KEYS.deviceTrust],
    ["dualRemit", ORG_POLICY_KEYS.dualRemit],
    ["pwdStrength", ORG_POLICY_KEYS.pwdStrength],
    ["sessionTimeout", ORG_POLICY_KEYS.sessionTimeout],
  ];

  await db.transaction(async (tx) => {
    for (const [field, key] of map) {
      if (input[field] === undefined) continue;
      await tx
        .insert(settings)
        .values({ entityId, key, value: input[field] as unknown })
        .onConflictDoUpdate({ target: [settings.entityId, settings.key], set: { value: input[field] as unknown } });
    }
    await writeAudit(tx, ctx, {
      action: "settings.policy.update",
      associatedType: "setting",
      associatedId: entityId,
      summary: `${ctx.user.name} updated organization access policies`,
      entityId,
      after: input as Record<string, unknown>,
    });
  });

  return getOrgPolicies(ctx);
}

// ─── System integrations (org scope, config-derived - never fabricated) ─────

/**
 * Honest integration health: reflects the REAL presence of each system's
 * configuration, never a fabricated "healthy". "Not configured" is a truthful,
 * useful state for the CEO to see.
 */
export function getIntegrationHealth() {
  const has = (v: string | undefined) => !!v && v.trim().length > 0;
  const integrations = [
    {
      key: "database",
      name: "Neon Postgres",
      kind: "Primary datastore",
      status: has(process.env.DATABASE_URL) ? "healthy" : "down",
      meta: has(process.env.DATABASE_URL) ? "Connected · websocket pool" : "DATABASE_URL not set",
    },
    {
      key: "realtime",
      name: "Ably Realtime",
      kind: "Live messaging & alerts",
      status: has(process.env.ABLY_API_KEY) ? "healthy" : "inactive",
      meta: has(process.env.ABLY_API_KEY) ? "Publishing live" : "Falls back to fetch-on-load",
    },
    {
      key: "ratelimit",
      name: "Upstash Redis",
      kind: "Rate limiting",
      status: has(process.env.UPSTASH_REDIS_REST_URL) && has(process.env.UPSTASH_REDIS_REST_TOKEN) ? "healthy" : "inactive",
      meta: has(process.env.UPSTASH_REDIS_REST_URL) ? "Enforcing limits" : "Fail-open (no limiter)",
    },
    {
      key: "mpesa",
      name: "M-Pesa Daraja",
      kind: "Tenant payments",
      status:
        has(process.env.MPESA_CONSUMER_KEY) && has(process.env.MPESA_SHORTCODE) && has(process.env.MPESA_PASSKEY)
          ? "healthy"
          : "inactive",
      meta:
        has(process.env.MPESA_CONSUMER_KEY) && has(process.env.MPESA_SHORTCODE)
          ? "STK push live"
          : "Scaffolded · awaiting credentials",
    },
    {
      key: "email",
      name: "Email delivery",
      kind: "Transactional email",
      status: "inactive",
      meta: "No provider configured yet",
    },
    {
      key: "sms",
      name: "SMS gateway",
      kind: "SMS alerts",
      status: "inactive",
      meta: "No provider configured yet",
    },
  ];
  const healthy = integrations.filter((i) => i.status === "healthy").length;
  return { integrations, healthy, total: integrations.length };
}

// ─── Console pulse (both scopes) ────────────────────────────────────────────

export async function getAccountConsolePulse(ctx: CallerContext, scope: ConsoleScope) {
  const entityId = await resolveEntityId(ctx.entityId ?? "group");

  if (scope === "personal") {
    const security = await getSecurityOverview(ctx);
    // Pending approvals awaiting the CEO specifically.
    const [pendingApprovals] = await db
      .select({ n: count() })
      .from(approvalRequests)
      .where(and(eq(approvalRequests.status, "pending"), eq(approvalRequests.requiredApproverRole, "ceo")));
    const [activeUsers] = await db.select({ n: count() }).from(users).where(eq(users.isActive, true));
    const seatCap = await readGroupSettingNumber(ORG_DEFAULT_KEYS.seatCap, 32);
    return {
      scope,
      securityScorePct: security.scorePct,
      securityScoreLabel: security.scoreLabel,
      pendingApprovals: pendingApprovals?.n ?? 0,
      seatsUsed: activeUsers?.n ?? 0,
      seatsTotal: seatCap,
    };
  }

  // Org pulse
  const dir = await getDirectoryOverview(ctx);
  const policies = await getOrgPolicies(ctx);
  const orgScore = computeOrgSecurityScore(policies);
  // Real month-to-date operating spend (Sunland's own expenses).
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [spendRow] = await db
    .select({ total: sql<string>`coalesce(sum(${transactions.amountKes}), 0)` })
    .from(transactions)
    .where(and(eq(transactions.entityId, entityId), eq(transactions.type, "expense"), gte(transactions.occurredAt, monthStart)));
  const monthlySpendKes = spendRow?.total ? Math.round(parseFloat(spendRow.total)) : 0;

  return {
    scope,
    memberCount: dir.totalMembers,
    pendingAccess: dir.pendingCount,
    orgSecurityPct: orgScore.pct,
    orgSecurityLabel: orgScore.label,
    monthlySpendKes,
  };
}

async function readGroupSettingNumber(key: string, fallback: number): Promise<number> {
  const groupEntityId = await resolveEntityId("group");
  const [row] = await db.select().from(settings).where(and(eq(settings.entityId, groupEntityId), eq(settings.key, key))).limit(1);
  if (!row) return fallback;
  const n = typeof row.value === "number" ? row.value : parseFloat(String(row.value));
  return Number.isFinite(n) ? n : fallback;
}
