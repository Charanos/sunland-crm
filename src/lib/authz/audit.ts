import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import type { CallerContext } from "@/lib/authz/context";

// The transaction object's type, inferred rather than typed as `typeof db` -
// db.transaction()'s callback parameter is a distinct (structurally similar
// but not assignable) type from the top-level NeonDatabase client.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type WriteAuditInput = {
  action: string;
  associatedType: string;
  associatedId: string;
  summary: string;
  /**
   * Required, deliberately no fallback to `ctx.entityId`: a service that has
   * resolved the *real* entity for this action (from the request body or the
   * loaded resource) must pass it explicitly. Trusting ctx.entityId here was
   * the root cause of a real bug - routes without a natural entity build ctx
   * with a placeholder, and several services relied on ctx.entityId instead
   * of the value they'd already resolved, crashing the uuid column. Pass
   * `null` explicitly for genuinely entity-independent actions (role/session
   * management) rather than defaulting to something that might be wrong.
   */
  entityId: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

/**
 * The single audit choke point (backend master §2, audit A-6). Always called
 * from inside the same transaction as the mutation it's recording, so the
 * audit row and the effect it describes commit or roll back together.
 */
export async function writeAudit(tx: Tx, ctx: CallerContext, input: WriteAuditInput) {
  await tx.insert(activityLogs).values({
    entityId: input.entityId,
    actorId: ctx.user.id,
    action: input.action,
    associatedType: input.associatedType,
    associatedId: input.associatedId,
    summary: input.summary,
    beforeData: input.before ?? null,
    afterData: input.after ?? null,
    requestId: ctx.requestId,
  });
}
