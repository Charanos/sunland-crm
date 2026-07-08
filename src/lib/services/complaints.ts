import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { complaints, users } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { createNotification } from "@/lib/services/notifications";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";
import {
  addComplaintNoteSchema,
  createComplaintSchema,
  escalateComplaintSchema,
  resolveComplaintSchema,
} from "@/lib/validation/complaints";
import { parseInput } from "@/lib/validation/parse";
import type { UserRole } from "@/types";

type ComplaintRow = typeof complaints.$inferSelect;
type ComplaintTier = "hr_head" | "gm" | "ceo";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
// The users.role column's own inferred literal union — deliberately not the
// broader `@/types` UserRole (which also carries retired prototype aliases
// like "rentals_officer" that were never real DB enum members), so this map
// stays assignable to eq(users.role, ...) without a cast.
type DbUserRole = (typeof users.$inferSelect)["role"];

/**
 * Complaint routing/visibility is hardcoded logic, never a granted RBAC
 * permission (HR spec §6.4) — a future change to the general permission
 * matrix must not be able to accidentally widen who sees a complaint.
 */
const COMPLAINT_TIER_BY_ROLE: Partial<Record<UserRole, ComplaintTier>> = {
  hr_head: "hr_head",
  general_manager: "gm",
  ceo: "ceo",
};

const TIER_TO_USER_ROLE: Record<ComplaintTier, DbUserRole> = {
  hr_head: "hr_head",
  gm: "general_manager",
  ceo: "ceo",
};

const NEXT_TIER: Record<ComplaintTier, ComplaintTier | null> = {
  hr_head: "gm",
  gm: "ceo",
  ceo: null,
};

/**
 * HR spec §6.4: a complaint naming a Department Head (Finance/HR/Front
 * Office Head) escalates straight to GM at file time — this is how a
 * complaint against HR Head itself is kept out of HR's own hands, since
 * HR Head is a Department Head like any other for this purpose. Naming the
 * GM escalates to CEO. Naming CEO has nowhere higher to go, so it stays
 * visible to CEO (a documented edge case, not left undefined). Everything
 * else — including a complaint naming a rank-and-file HR Officer — stays
 * with HR Head, the same as any other department's non-head staff.
 */
async function computeInitialOwner(
  namedPersonId: string | null,
): Promise<{ ownerRole: ComplaintTier; initialStatus: "open" | "escalated" }> {
  if (!namedPersonId) return { ownerRole: "hr_head", initialStatus: "open" };

  const [namedUser] = await db.select().from(users).where(eq(users.id, namedPersonId)).limit(1);
  if (!namedUser) return { ownerRole: "hr_head", initialStatus: "open" };

  if (namedUser.role === "general_manager") return { ownerRole: "ceo", initialStatus: "escalated" };
  if (namedUser.role === "ceo") return { ownerRole: "ceo", initialStatus: "open" };
  if (["hr_head", "finance_head", "front_office_head"].includes(namedUser.role)) {
    return { ownerRole: "gm", initialStatus: "escalated" };
  }

  return { ownerRole: "hr_head", initialStatus: "open" };
}

/** Content-free by design (HR spec §8.8) — never names the complainant, subject, or category. */
async function notifyOwnerTier(tx: Tx, complaint: ComplaintRow) {
  const targetRole = TIER_TO_USER_ROLE[complaint.currentOwnerRole as ComplaintTier];
  const recipients = await tx.select().from(users).where(eq(users.role, targetRole));

  for (const recipient of recipients) {
    await createNotification(tx, {
      userId: recipient.id,
      entityId: complaint.entityId,
      type: "complaint.assigned",
      title: "Complaint requires your attention",
      body: "A complaint has been filed or escalated and is awaiting your review.",
      associatedType: "complaint",
      associatedId: complaint.id,
      href: "/admin/hr/complaints",
    });
  }
}

function assertCurrentOwner(ctx: CallerContext, complaint: ComplaintRow) {
  const tier = COMPLAINT_TIER_BY_ROLE[ctx.user.role as UserRole];
  if (!tier || tier !== complaint.currentOwnerRole) {
    // Never ForbiddenError here — existence itself must not be confirmable (HR spec §6.2).
    throw new NotFoundError("Complaint not found");
  }
}

/**
 * True anonymity, not just a display convention — when the toggle is used,
 * identity is withheld from every viewer but the filer themselves, current
 * owner included. This is what makes "Request Input" (a scoped question to
 * a third party without revealing identity) meaningfully anonymous rather
 * than security theatre.
 */
function sanitizeForViewer(complaint: ComplaintRow, viewerId: string) {
  const isOwnComplaint = complaint.filedById === viewerId;
  if (!complaint.isAnonymous || isOwnComplaint) return complaint;
  return { ...complaint, filedById: null as unknown as string };
}

/** Anyone can file — no permission gate, same self-scoped pattern as scheduling and support tickets. */
export async function createComplaint(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(createComplaintSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);
  const { ownerRole, initialStatus } = await computeInitialOwner(input.namedPersonId ?? null);

  return db.transaction(async (tx) => {
    const [complaint] = await tx
      .insert(complaints)
      .values({
        entityId,
        filedById: ctx.user.id,
        isAnonymous: input.isAnonymous,
        namedPersonId: input.namedPersonId ?? null,
        category: input.category,
        subject: input.subject,
        description: input.description,
        status: initialStatus,
        currentOwnerRole: ownerRole,
      })
      .returning();

    // Redacted deliberately — content/identity must never surface in the
    // general audit log (HR spec §8.8), which anyone with audit.log.read
    // (including finance_head, auditor_compliance) can browse.
    await writeAudit(tx, ctx, {
      action: "hr.complaint.create",
      associatedType: "complaint",
      associatedId: complaint.id,
      summary: "Complaint filed",
      entityId,
    });

    await notifyOwnerTier(tx, complaint);

    return complaint;
  });
}

/**
 * Tab views are HR Head's/GM's/CEO's own working queues — matches HR spec
 * §8.8 exactly (My Queue / Escalated / Resolved & Closed). A role with no
 * complaint tier gets an empty list, not an error — absence, not restriction.
 */
export async function listComplaints(
  ctx: CallerContext,
  filters: { entityId?: string; tab: "my-queue" | "escalated" | "resolved" },
) {
  const rawEntityId = filters.entityId ?? ctx.entityId;
  if (!rawEntityId) return [];
  const entityId = await resolveEntityId(rawEntityId);

  const tier = COMPLAINT_TIER_BY_ROLE[ctx.user.role as UserRole];
  if (!tier) return [];

  if (tier === "hr_head") {
    await authorize(ctx, "hr.complaint.manage", entityId);
  }

  const statusForTab = filters.tab === "my-queue" ? "open" : filters.tab === "escalated" ? "escalated" : "resolved";

  const rows = await db
    .select()
    .from(complaints)
    .where(
      and(
        eq(complaints.entityId, entityId),
        eq(complaints.currentOwnerRole, tier),
        eq(complaints.status, statusForTab),
      ),
    );

  return rows.map((row) => sanitizeForViewer(row, ctx.user.id));
}

/** 404s (never 403s) for anyone who isn't the filer and doesn't tier-match — existence itself is need-to-know. */
export async function getComplaint(ctx: CallerContext, complaintId: string) {
  const [complaint] = await db.select().from(complaints).where(eq(complaints.id, complaintId)).limit(1);
  if (!complaint) throw new NotFoundError("Complaint not found");

  const isFiler = complaint.filedById === ctx.user.id;
  const tier = COMPLAINT_TIER_BY_ROLE[ctx.user.role as UserRole];
  const isCurrentOwner = tier === complaint.currentOwnerRole;

  if (!isFiler && !isCurrentOwner) throw new NotFoundError("Complaint not found");

  return sanitizeForViewer(complaint, ctx.user.id);
}

export async function escalateComplaint(ctx: CallerContext, complaintId: string, rawInput: unknown) {
  const input = parseInput(escalateComplaintSchema, rawInput);
  const [existing] = await db.select().from(complaints).where(eq(complaints.id, complaintId)).limit(1);
  if (!existing) throw new NotFoundError("Complaint not found");
  assertCurrentOwner(ctx, existing);

  const nextOwner = NEXT_TIER[existing.currentOwnerRole as ComplaintTier];
  if (!nextOwner) throw new DomainValidationError("Complaint is already at the highest tier");

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(complaints)
      .set({
        currentOwnerRole: nextOwner,
        status: "escalated",
        escalatedAt: new Date(),
        escalatedById: ctx.user.id,
        escalationReason: input.reason,
        updatedAt: new Date(),
      })
      .where(eq(complaints.id, complaintId))
      .returning();

    await writeAudit(tx, ctx, {
      action: "hr.complaint.escalate",
      associatedType: "complaint",
      associatedId: complaintId,
      summary: "Complaint escalated",
      entityId: existing.entityId,
    });

    await notifyOwnerTier(tx, updated);

    return sanitizeForViewer(updated, ctx.user.id);
  });
}

export async function resolveComplaint(ctx: CallerContext, complaintId: string, rawInput: unknown) {
  const input = parseInput(resolveComplaintSchema, rawInput);
  const [existing] = await db.select().from(complaints).where(eq(complaints.id, complaintId)).limit(1);
  if (!existing) throw new NotFoundError("Complaint not found");
  assertCurrentOwner(ctx, existing);

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(complaints)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
        resolvedById: ctx.user.id,
        resolutionSummary: input.resolutionSummary,
        updatedAt: new Date(),
      })
      .where(eq(complaints.id, complaintId))
      .returning();

    await writeAudit(tx, ctx, {
      action: "hr.complaint.resolve",
      associatedType: "complaint",
      associatedId: complaintId,
      summary: "Complaint resolved",
      entityId: existing.entityId,
    });

    // Safe to include real content here — the filer already knows their own complaint.
    await createNotification(tx, {
      userId: existing.filedById,
      entityId: existing.entityId,
      type: "complaint.resolved",
      title: "Your complaint has been resolved",
      body: input.resolutionSummary,
      associatedType: "complaint",
      associatedId: complaintId,
    });

    return sanitizeForViewer(updated, ctx.user.id);
  });
}

export async function addComplaintNote(ctx: CallerContext, complaintId: string, rawInput: unknown) {
  const input = parseInput(addComplaintNoteSchema, rawInput);
  const [existing] = await db.select().from(complaints).where(eq(complaints.id, complaintId)).limit(1);
  if (!existing) throw new NotFoundError("Complaint not found");
  assertCurrentOwner(ctx, existing);

  const notes = (existing.internalNotes as Array<{ authorId: string; note: string; at: string }>) ?? [];
  const nextNotes = [...notes, { authorId: ctx.user.id, note: input.note, at: new Date().toISOString() }];

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(complaints)
      .set({ internalNotes: nextNotes, updatedAt: new Date() })
      .where(eq(complaints.id, complaintId))
      .returning();

    await writeAudit(tx, ctx, {
      action: "hr.complaint.note",
      associatedType: "complaint",
      associatedId: complaintId,
      summary: "Note added to complaint",
      entityId: existing.entityId,
    });

    return sanitizeForViewer(updated, ctx.user.id);
  });
}
