import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { DomainValidationError } from "@/lib/authz/errors";
import type { CallerContext } from "@/lib/services/types";

export type AuditLogFilters = {
  entityId?: string;
  actorId?: string;
  action?: string;
  associatedType?: string;
  associatedId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
};

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export async function listAuditLog(ctx: CallerContext, filters: AuditLogFilters = {}) {
  const entityId = filters.entityId ?? ctx.entityId;
  if (!entityId) throw new DomainValidationError("entityId is required");
  await authorize(ctx, "audit.log.read", entityId);

  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = filters.offset ?? 0;

  const conditions = [eq(activityLogs.entityId, entityId)];
  if (filters.actorId) conditions.push(eq(activityLogs.actorId, filters.actorId));
  if (filters.action) conditions.push(eq(activityLogs.action, filters.action));
  if (filters.associatedType) conditions.push(eq(activityLogs.associatedType, filters.associatedType));
  if (filters.associatedId) conditions.push(eq(activityLogs.associatedId, filters.associatedId));
  if (filters.dateFrom) conditions.push(gte(activityLogs.createdAt, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(activityLogs.createdAt, new Date(filters.dateTo)));

  return db
    .select()
    .from(activityLogs)
    .where(and(...conditions))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit)
    .offset(offset);
}
