import { and, desc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, users } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { DomainValidationError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";

export type AuditLogFilters = {
  entityId?: string;
  actorId?: string;
  action?: string;
  associatedType?: string;
  associatedId?: string;
  /**
   * Cross-entity read: matches rows belonging to ANY of these
   * (associatedType, one-of-ids) groups, in addition to / instead of the
   * single associatedType/associatedId pair above. Lets a caller like "this
   * property's full activity" pull its own rows plus its mandates', leases',
   * maintenance requests', and documents' rows in one query, since audit rows
   * are written against the entity that changed (a mandate, a lease...), not
   * a secondary "which property is this about" column.
   */
  associatedGroups?: Array<{ type: string; ids: string[] }>;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
};

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export async function listAuditLog(ctx: CallerContext, filters: AuditLogFilters = {}) {
  const entityIdParam = filters.entityId ?? ctx.entityId;
  if (!entityIdParam) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(entityIdParam);
  await authorize(ctx, "audit.log.read", entityId);

  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = filters.offset ?? 0;

  const conditions = [eq(activityLogs.entityId, entityId)];
  if (filters.actorId) conditions.push(eq(activityLogs.actorId, filters.actorId));
  if (filters.action) conditions.push(eq(activityLogs.action, filters.action));

  // associatedGroups and the single associatedType/associatedId pair are
  // mutually exclusive - a caller building a cross-entity read supplies only
  // groups, so there's no ambiguity about which one wins.
  const groups = filters.associatedGroups?.filter((g) => g.ids.length > 0) ?? [];
  if (groups.length > 0) {
    conditions.push(or(...groups.map((g) => and(eq(activityLogs.associatedType, g.type), inArray(activityLogs.associatedId, g.ids))))!);
  } else {
    if (filters.associatedType) conditions.push(eq(activityLogs.associatedType, filters.associatedType));
    if (filters.associatedId) conditions.push(eq(activityLogs.associatedId, filters.associatedId));
  }
  if (filters.dateFrom) conditions.push(gte(activityLogs.createdAt, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(activityLogs.createdAt, new Date(filters.dateTo)));

  return db
    .select({
      id: activityLogs.id,
      entityId: activityLogs.entityId,
      actorId: activityLogs.actorId,
      actorName: users.name,
      associatedType: activityLogs.associatedType,
      associatedId: activityLogs.associatedId,
      action: activityLogs.action,
      summary: activityLogs.summary,
      beforeData: activityLogs.beforeData,
      afterData: activityLogs.afterData,
      requestId: activityLogs.requestId,
      metadata: activityLogs.metadata,
      createdAt: activityLogs.createdAt,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.actorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit)
    .offset(offset);
}
