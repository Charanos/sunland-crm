import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leads, users } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";

function toNumber(value: string | null): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isNaN(n) ? 0 : n;
}

export type AgentPerformanceRow = {
  userId: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  closedDealsCount: number;
  totalValueKes: number;
  activePipelineCount: number;
  totalLeadsCount: number;
  conversionRate: number;
};

/** Same visibility as the CRM board itself — crm.lead.read is already the coarse, team-wide grant. */
export async function getAgentPerformance(ctx: CallerContext): Promise<AgentPerformanceRow[]> {
  const entityId = await resolveEntityId(ctx.entityId || "group");
  await authorize(ctx, "crm.lead.read", entityId);

  const [entityLeads, allUsers] = await Promise.all([
    db.select().from(leads).where(eq(leads.entityId, entityId)),
    db.select().from(users),
  ]);

  const usersById = new Map(allUsers.map((u) => [u.id, u]));
  const leadsByAgent = new Map<string, typeof entityLeads>();
  for (const lead of entityLeads) {
    if (!lead.assignedToId) continue;
    const list = leadsByAgent.get(lead.assignedToId) ?? [];
    list.push(lead);
    leadsByAgent.set(lead.assignedToId, list);
  }

  const rows: AgentPerformanceRow[] = [];
  for (const [userId, agentLeads] of leadsByAgent) {
    const user = usersById.get(userId);
    if (!user) continue; // assignedToId is FK-guaranteed to exist; skip defensively rather than crash a leaderboard

    const closedWon = agentLeads.filter((l) => l.stage === "closed_won");
    const activePipeline = agentLeads.filter((l) => l.stage !== "closed_won" && l.stage !== "closed_lost");
    const totalValueKes = closedWon.reduce((sum, l) => sum + toNumber(l.expectedValueKes), 0);

    rows.push({
      userId,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      closedDealsCount: closedWon.length,
      totalValueKes: Math.round(totalValueKes),
      activePipelineCount: activePipeline.length,
      totalLeadsCount: agentLeads.length,
      conversionRate: agentLeads.length > 0 ? Math.round((closedWon.length / agentLeads.length) * 1000) / 10 : 0,
    });
  }

  return rows.sort((a, b) => b.totalValueKes - a.totalValueKes);
}
