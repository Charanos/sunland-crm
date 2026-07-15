import { randomBytes } from "crypto";
import { eq, and, ne, or, desc, gte, inArray, getTableColumns, SQL } from "drizzle-orm";
import { db } from "@/db";
import { properties, leases, documents, transactions, contacts, maintenanceRequests, leads, propertyMandates, approvalRequests, users } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { ConflictError, DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import { listAuditLog } from "@/lib/services/audit-log";
import type { CallerContext } from "@/lib/services/types";

// ─── Properties ──────────────────────────────────────────────────────────────

export function toISOStringSafe(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") {
    if (val.includes("T") && val.includes("Z")) return val;
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toISOString();
    } catch {}
    return val;
  }
  try {
    const d = new Date(val as string | number | Date);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {}
  return null;
}


export async function listProperties(
  ctx: CallerContext,
  filters: { ownerContactId?: string } = {}
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.property.read", entityId);

  let conditions: SQL | undefined = eq(properties.entityId, entityId);
  if (filters.ownerContactId) {
    conditions = and(conditions, eq(properties.ownerContactId, filters.ownerContactId));
  }

  // Left join scoped to at-most-one in-flight mandate per property (the
  // partial unique index on property_mandates guarantees no fan-out here) -
  // surfaces mandateStatus on the board without a second round trip.
  // Owner contact is also left-joined here so the board/quick-view never has
  // to fall back to a raw ownerContactId label.
  const rows = await db
    .select({
      ...getTableColumns(properties),
      mandateStatus: propertyMandates.status,
      ownerName: contacts.displayName,
      ownerPhone: contacts.phone,
      ownerEmail: contacts.email,
      ownerCompany: contacts.companyName,
      ownerIdNumber: contacts.idNumber,
      ownerVerifiedAt: contacts.verifiedAt,
      ownerClientSince: contacts.createdAt,
      ownerAvatarUrl: contacts.avatarUrl,
      managerId: propertyMandates.assignedPmId,
      managerName: users.name,
      managerTitle: users.title,
      managerEmail: users.email,
      managerAvatarUrl: users.avatarUrl,
    })
    .from(properties)
    .leftJoin(
      propertyMandates,
      and(
        eq(propertyMandates.propertyId, properties.id),
        inArray(propertyMandates.status, ["pending_approval", "active"]),
      ),
    )
    .leftJoin(contacts, eq(contacts.id, properties.ownerContactId))
    .leftJoin(users, eq(users.id, propertyMandates.assignedPmId))
    .where(conditions);

  return rows.map(({ ownerName, ownerPhone, ownerEmail, ownerCompany, ownerIdNumber, ownerVerifiedAt, ownerClientSince, ownerAvatarUrl, managerId, managerName, managerTitle, managerEmail, managerAvatarUrl, ...rest }) => ({
    ...rest,
    ownerName,
    owner: rest.ownerContactId
      ? {
        name: ownerName,
        phone: ownerPhone,
        email: ownerEmail,
        company: ownerCompany,
        idNumber: ownerIdNumber,
        verifiedAt: toISOStringSafe(ownerVerifiedAt),
        clientSince: toISOStringSafe(ownerClientSince),
        avatarUrl: ownerAvatarUrl,
      }
      : null,
    manager: managerId
      ? {
        id: managerId,
        name: managerName,
        title: managerTitle,
        email: managerEmail,
        avatarUrl: managerAvatarUrl,
      }
      : null,
  }));
}

type UnitBreakdownEntry = { unitType: string; count: number; monthlyRentKes?: string };
type MediaEntry = { url: string; alt?: string };

function validateUnitBreakdown(entries: UnitBreakdownEntry[] | undefined | null): UnitBreakdownEntry[] {
  if (!entries || entries.length === 0) return [];
  for (const entry of entries) {
    if (!entry.unitType || typeof entry.unitType !== "string") {
      throw new DomainValidationError("Each unit breakdown entry needs a unit type.");
    }
    if (!Number.isFinite(entry.count) || entry.count < 1) {
      throw new DomainValidationError(`Unit count for "${entry.unitType}" must be at least 1.`);
    }
  }
  return entries;
}

function generatePropertyCode(propertyType: string): string {
  const typeMap: Record<string, string> = {
    Commercial: "COM",
    Residential: "RES",
    Industrial: "IND",
    Land: "LND",
  };
  const typeCode = typeMap[propertyType] || "OTH";
  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const hash = randomBytes(2).toString('hex').toUpperCase();
  return `SL-${typeCode}-${yy}${mm}-${hash}`;
}

export async function createProperty(
  ctx: CallerContext,
  input: {
    propertyCode?: string;
    name: string;
    propertyType: string;
    listingType: string;
    location: string;
    ownerContactId?: string | null;
    askingPriceKes?: string | null;
    monthlyRentKes?: string | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    sizeSqft?: number | null;
    landAreaSqft?: number | null;
    yearBuilt?: number | null;
    parkingSpaces?: number | null;
    amenities?: string[] | null;
    description?: string | null;
    media?: MediaEntry[];
    unitBreakdown?: UnitBreakdownEntry[];
  }
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.property.write", entityId);

  if (!input.name || !input.propertyType || !input.listingType || !input.location) {
    throw new DomainValidationError("Name, type, listing type, and location are required.");
  }
  const unitBreakdown = validateUnitBreakdown(input.unitBreakdown);

  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(properties)
      .values({
        entityId,
        propertyCode: input.propertyCode || generatePropertyCode(input.propertyType),
        name: input.name,
        propertyType: input.propertyType,
        listingType: input.listingType,
        location: input.location,
        ownerContactId: input.ownerContactId ?? null,
        askingPriceKes: input.askingPriceKes ?? null,
        monthlyRentKes: input.monthlyRentKes ?? null,
        bedrooms: input.bedrooms ?? null,
        bathrooms: input.bathrooms ?? null,
        sizeSqft: input.sizeSqft ?? null,
        landAreaSqft: input.landAreaSqft ?? null,
        yearBuilt: input.yearBuilt ?? null,
        parkingSpaces: input.parkingSpaces ?? null,
        amenities: input.amenities ?? [],
        description: input.description ?? null,
        media: input.media ?? [],
        unitBreakdown,
        status: "available",
      })
      .returning();

    await writeAudit(tx, ctx, {
      action: "properties.property.create",
      associatedType: "property",
      associatedId: inserted.id,
      summary: `Registered property ${inserted.name} (Code: ${inserted.propertyCode})`,
      entityId,
      before: null,
      after: inserted,
    });

    return inserted;
  });
}

export async function updateProperty(
  ctx: CallerContext,
  propertyId: string,
  input: Partial<{
    propertyCode: string;
    name: string;
    propertyType: string;
    listingType: string;
    location: string;
    ownerContactId: string | null;
    askingPriceKes: string | null;
    monthlyRentKes: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    sizeSqft: number | null;
    landAreaSqft: number | null;
    yearBuilt: number | null;
    parkingSpaces: number | null;
    amenities: string[] | null;
    description: string | null;
    status: "available" | "occupied" | "under_offer" | "off_market" | "maintenance";
    media: MediaEntry[];
    unitBreakdown: UnitBreakdownEntry[];
    isFeatured: boolean;
  }>
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.property.write", entityId);

  const [existing] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.entityId, entityId)));
  if (!existing) throw new NotFoundError("Property not found");

  if (input.unitBreakdown !== undefined) {
    validateUnitBreakdown(input.unitBreakdown);
  }

  // Explicitly whitelisted rather than spreading `input` - the route forwards
  // the raw request body, which routinely carries an `entityId` (a slug like
  // "group", used only for scoping) that is NOT a real column value; blindly
  // spreading it into .set() wrote that literal string into the entity_id
  // uuid column and crashed every edit that included it. Real bug, caught by
  // testing the actual PATCH payload shape a client sends, not just the
  // service function in isolation.
  const updatableFields = {
    propertyCode: input.propertyCode,
    name: input.name,
    propertyType: input.propertyType,
    listingType: input.listingType,
    location: input.location,
    ownerContactId: input.ownerContactId,
    askingPriceKes: input.askingPriceKes,
    monthlyRentKes: input.monthlyRentKes,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    sizeSqft: input.sizeSqft,
    landAreaSqft: input.landAreaSqft,
    yearBuilt: input.yearBuilt,
    parkingSpaces: input.parkingSpaces,
    amenities: input.amenities,
    description: input.description,
    status: input.status,
    media: input.media,
    unitBreakdown: input.unitBreakdown,
    isFeatured: input.isFeatured,
  };
  for (const key of Object.keys(updatableFields) as (keyof typeof updatableFields)[]) {
    if (updatableFields[key] === undefined) delete updatableFields[key];
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(properties)
      .set({
        ...updatableFields,
        updatedAt: new Date(),
      })
      .where(and(eq(properties.id, propertyId), eq(properties.entityId, entityId)))
      .returning();

    await writeAudit(tx, ctx, {
      action: "properties.property.update",
      associatedType: "property",
      associatedId: updated.id,
      summary: describePropertyUpdate(Object.keys(updatableFields), existing, updated),
      entityId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

/**
 * The PATCH payload's own key list already says exactly what was targeted -
 * no need to diff every column. Named single-field cases (the common
 * board actions: status change, feature toggle) get a precise sentence;
 * anything broader (the full edit form) gets a readable field list instead
 * of the old one-size-fits-all "Updated property details".
 */
function describePropertyUpdate(
  changedKeys: string[],
  before: typeof properties.$inferSelect,
  after: typeof properties.$inferSelect,
): string {
  if (changedKeys.length === 1) {
    const key = changedKeys[0];
    if (key === "status") return `Changed status from "${STATUS_LABELS[before.status] ?? before.status}" to "${STATUS_LABELS[after.status] ?? after.status}" for ${after.name}`;
    if (key === "isFeatured") return `${after.isFeatured ? "Marked" : "Removed"} ${after.name} ${after.isFeatured ? "as featured" : "from featured"}`;
    if (key === "ownerContactId") return `Changed the registered owner for ${after.name}`;
  }
  const FIELD_LABELS: Record<string, string> = {
    propertyCode: "code", name: "name", propertyType: "type", listingType: "listing type", location: "location",
    ownerContactId: "owner", askingPriceKes: "asking price", monthlyRentKes: "monthly rent", bedrooms: "bedrooms",
    bathrooms: "bathrooms", sizeSqft: "size", landAreaSqft: "land area", yearBuilt: "year built",
    parkingSpaces: "parking", amenities: "amenities", description: "description", status: "status",
    media: "photos", unitBreakdown: "unit breakdown", isFeatured: "featured status",
  };
  const labels = changedKeys.map((k) => FIELD_LABELS[k] ?? k);
  return `Updated ${labels.join(", ")} for ${after.name}`;
}

const STATUS_LABELS: Record<string, string> = {
  available: "Available", occupied: "Occupied", under_offer: "Under Offer", off_market: "Off Market", maintenance: "Maintenance",
};

export async function deleteProperty(ctx: CallerContext, propertyId: string) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.property.write", entityId);

  const [existing] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.entityId, entityId)));
  if (!existing) throw new NotFoundError("Property not found");

  // Block on the common blockers with a clear message rather than letting a
  // raw Postgres FK violation surface as an opaque 500 (leases/transactions/
  // maintenance_requests/leads all reference properties.id with no cascade).
  const [existingLease] = await db.select({ id: leases.id }).from(leases).where(eq(leases.propertyId, propertyId)).limit(1);
  if (existingLease) {
    throw new ConflictError("Property has lease history and cannot be deleted; mark it off-market instead.");
  }
  const [existingTransaction] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.propertyId, propertyId))
    .limit(1);
  if (existingTransaction) {
    throw new ConflictError("Property has recorded transactions and cannot be deleted; mark it off-market instead.");
  }

  return db.transaction(async (tx) => {
    try {
      await tx
        .delete(properties)
        .where(and(eq(properties.id, propertyId), eq(properties.entityId, entityId)));
    } catch {
      // Fallback for less common referencing tables (maintenance_requests, leads).
      throw new ConflictError("Property is referenced by other records and cannot be deleted; mark it off-market instead.");
    }

    await writeAudit(tx, ctx, {
      action: "properties.property.delete",
      associatedType: "property",
      associatedId: propertyId,
      summary: `Deleted property ${existing.name} (Code: ${existing.propertyCode})`,
      entityId,
      before: existing,
      after: null,
    });
  });
}

// ─── Property Details ──────────────────────────────────────────────────────────

/**
 * Assembles the full-view page's data contract (property-detail-types.ts's
 * PropertyDetail) in one call. Every derived figure (collections, arrears,
 * vacantSince, lease status) is computed live from the base tables on read -
 * never stored - per the ledger doc §8.1 single-source-of-truth rule.
 */
export async function getPropertyWithDetails(ctx: CallerContext, propertyId: string) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.property.read", entityId);

  const [prop] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.entityId, entityId)));

  if (!prop) throw new NotFoundError("Property not found");

  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [ownerRows, leaseRows, maintenanceRows, documentRows, rentTxRows, expenseTxRows, leadRows, mandateRows] = await Promise.all([
    prop.ownerContactId
      ? db
        .select({
          id: contacts.id,
          displayName: contacts.displayName,
          email: contacts.email,
          phone: contacts.phone,
          idNumber: contacts.idNumber,
          verifiedAt: contacts.verifiedAt,
          verifiedByName: users.name,
          avatarUrl: contacts.avatarUrl,
        })
        .from(contacts)
        .leftJoin(users, eq(contacts.verifiedById, users.id))
        .where(eq(contacts.id, prop.ownerContactId))
        .limit(1)
      : Promise.resolve([]),
    db
      .select({
        id: leases.id,
        startsAt: leases.startsAt,
        endsAt: leases.endsAt,
        monthlyRentKes: leases.monthlyRentKes,
        depositKes: leases.depositKes,
        isActive: leases.isActive,
        tenantContactId: leases.tenantContactId,
        tenantName: contacts.displayName,
        tenantPhone: contacts.phone,
        tenantEmail: contacts.email,
      })
      .from(leases)
      .innerJoin(contacts, eq(leases.tenantContactId, contacts.id))
      .where(eq(leases.propertyId, propertyId))
      .orderBy(desc(leases.startsAt)),
    db
      .select({
        id: maintenanceRequests.id,
        title: maintenanceRequests.title,
        priority: maintenanceRequests.priority,
        status: maintenanceRequests.status,
        createdAt: maintenanceRequests.createdAt,
        reportedBy: contacts.displayName,
      })
      .from(maintenanceRequests)
      .leftJoin(contacts, eq(maintenanceRequests.reportedByContactId, contacts.id))
      .where(eq(maintenanceRequests.propertyId, propertyId))
      .orderBy(desc(maintenanceRequests.createdAt)),
    db
      .select()
      .from(documents)
      // Property-scoped docs (title deeds, leases) plus the owner's own
      // documents (ID, mandate letter) - the property form modal saves the
      // latter with only ownerContactId set, since one landlord's ID/title
      // deed applies across every property they own (ADR 014 §14.4).
      .where(
        prop.ownerContactId
          ? or(eq(documents.propertyId, propertyId), eq(documents.ownerContactId, prop.ownerContactId))
          : eq(documents.propertyId, propertyId),
      )
      .orderBy(desc(documents.createdAt)),
    db
      .select({ amountKes: transactions.amountKes, occurredAt: transactions.occurredAt })
      .from(transactions)
      .where(
        and(
          eq(transactions.propertyId, propertyId),
          eq(transactions.type, "rent"),
          gte(transactions.occurredAt, sixMonthsAgo),
        ),
      ),
    db
      .select({ amountKes: transactions.amountKes, occurredAt: transactions.occurredAt })
      .from(transactions)
      .where(
        and(
          eq(transactions.propertyId, propertyId),
          eq(transactions.type, "expense"),
          gte(transactions.occurredAt, sixMonthsAgo),
        ),
      ),
    db
      .select({
        stage: leads.stage,
        expectedValueKes: leads.expectedValueKes,
        updatedAt: leads.updatedAt,
        leadName: contacts.displayName,
      })
      .from(leads)
      .innerJoin(contacts, eq(leads.contactId, contacts.id))
      .where(eq(leads.propertyId, propertyId))
      .orderBy(desc(leads.updatedAt))
      .limit(1),
    db
      .select({
        ...getTableColumns(propertyMandates),
        managerName: users.name,
        managerTitle: users.title,
        managerEmail: users.email,
        managerAvatarUrl: users.avatarUrl,
      })
      .from(propertyMandates)
      .leftJoin(users, eq(propertyMandates.assignedPmId, users.id))
      .where(
        and(
          eq(propertyMandates.propertyId, propertyId),
          inArray(propertyMandates.status, ["pending_approval", "active"]),
        ),
      )
      .limit(1),
  ]);

  // Owner mapped to the frontend's OwnerInfo shape - the board reads
  // owner.name, not the contacts table's displayName.
  const ownerRow = ownerRows[0];
  const owner = ownerRow
    ? {
      id: ownerRow.id,
      name: ownerRow.displayName,
      email: ownerRow.email,
      phone: ownerRow.phone,
      idNumber: ownerRow.idNumber,
      verifiedAt: toISOStringSafe(ownerRow.verifiedAt),
      verifiedByName: ownerRow.verifiedByName,
      avatarUrl: ownerRow.avatarUrl,
    }
    : null;

  const activeLeaseRows = leaseRows.filter((l) => l.isActive);
  const sixtyDaysOut = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const leaseSummaries = leaseRows.map((l) => ({
    id: l.id,
    tenantContactId: l.tenantContactId,
    isActive: l.isActive,
    tenantName: l.tenantName,
    tenantPhone: l.tenantPhone ?? undefined,
    tenantEmail: l.tenantEmail ?? undefined,
    startDate: toISOStringSafe(l.startsAt) || "",
    endDate: toISOStringSafe(l.endsAt),
    status: !l.isActive
      ? ("ended" as const)
      : l.endsAt && l.endsAt <= sixtyDaysOut
        ? ("expiring" as const)
        : ("active" as const),
    monthlyRentKes: l.monthlyRentKes,
    depositKes: l.depositKes,
  }));

  // Expected monthly rent: sum of active leases, falling back to the listed
  // rate - expected must reflect the contracted amount when a tenancy exists.
  const expectedMonthly = activeLeaseRows.length > 0
    ? activeLeaseRows.reduce((sum, l) => sum + parseFloat(l.monthlyRentKes), 0)
    : prop.monthlyRentKes
      ? parseFloat(prop.monthlyRentKes)
      : 0;

  // Six-month collection history bucketed by calendar month, oldest first.
  const collections = Array.from({ length: 6 }, (_, i) => {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const collected = rentTxRows
      .filter((t) => {
        const d = t.occurredAt;
        return d.getFullYear() === monthStart.getFullYear() && d.getMonth() === monthStart.getMonth();
      })
      .reduce((sum, t) => sum + parseFloat(t.amountKes), 0);
    return {
      period: monthStart.toLocaleDateString("en-KE", { month: "short" }),
      expected: expectedMonthly,
      collected,
    };
  });

  // Arrears reads the current month's bucket - only meaningful with a tenancy.
  const currentMonth = collections[collections.length - 1];
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthExpenses = expenseTxRows
    .filter((t) => t.occurredAt >= currentMonthStart)
    .reduce((sum, t) => sum + parseFloat(t.amountKes), 0);
  let arrears: { status: "current" | "partial" | "defaulted"; amount: number; daysInArrears: number } | null = null;
  if (activeLeaseRows.length > 0 && expectedMonthly > 0) {
    const shortfall = Math.max(0, expectedMonthly - currentMonth.collected);
    arrears = {
      status: currentMonth.collected >= expectedMonthly ? "current" : currentMonth.collected > 0 ? "partial" : "defaulted",
      amount: shortfall,
      daysInArrears: shortfall > 0 ? now.getDate() : 0,
    };
  }

  // Vacancy start: latest ended tenancy, only when nothing is currently let.
  const vacantSinceDate =
    prop.status !== "occupied" && activeLeaseRows.length === 0
      ? leaseRows
        .filter((l) => !l.isActive && l.endsAt)
        .reduce<Date | null>((latest, l) => (!latest || l.endsAt > latest ? l.endsAt : latest), null)
      : null;
  const vacantSince = toISOStringSafe(vacantSinceDate);

  // The full CRM pipeline stages collapse into the board's four display
  // stages; a lost deal means there is no live pipeline to show.
  const leadRow = leadRows[0];
  const salesPipeline = leadRow && leadRow.stage !== "closed_lost"
    ? {
      stage:
        leadRow.stage === "closed_won"
          ? ("sale" as const)
          : leadRow.stage === "offer" || leadRow.stage === "negotiation"
            ? ("offer" as const)
            : leadRow.stage === "viewing"
              ? ("viewing" as const)
              : ("lead" as const),
      leadName: leadRow.leadName,
      offerAmountKes: leadRow.expectedValueKes,
      lastActivityAt: toISOStringSafe(leadRow.updatedAt) || "",
    }
    : null;

  const documentSummaries = documentRows.map((d) => ({
    id: d.id,
    name: d.title,
    status: ((d.metadata as Record<string, unknown> | null)?.status as "draft" | "awaiting_signature" | "signed") ?? "signed",
    url: d.fileUrl,
    type: d.type,
  }));

  // A pending mandate's own status doesn't say who it's waiting on - that
  // lives on its approval_requests row - so the rail card can show "Pending
  // GM" vs "Pending CEO" rather than a generic "Pending".
  const mandateRow = mandateRows[0];
  let pendingApproverRole: "gm" | "ceo" | "department_head" | null = null;
  let pendingApprovalRequestId: string | null = null;
  if (mandateRow && mandateRow.status === "pending_approval") {
    const [pendingApproval] = await db
      .select({ id: approvalRequests.id, requiredApproverRole: approvalRequests.requiredApproverRole })
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.relatedTable, "property_mandates"),
          eq(approvalRequests.relatedId, mandateRow.id),
          eq(approvalRequests.status, "pending"),
        ),
      )
      .limit(1);
    pendingApproverRole = pendingApproval?.requiredApproverRole ?? null;
    pendingApprovalRequestId = pendingApproval?.id ?? null;
  }
  const mandateRate = mandateRow ? parseFloat(mandateRow.mandateRate) : 0;
  // Current-period snapshot derived live from this month's collections
  // bucket - no periodic ledger exists yet (mandate_collections/expenses is
  // a deferred finance-ledger phase), so this is deliberately just the two
  // figures that are honestly computable today rather than a full remittance
  // statement.
  const currentPeriod =
    mandateRow && mandateRow.status === "active"
      ? {
        collectedAmount: currentMonth.collected,
        managementFee: currentMonth.collected * mandateRate,
        expenses: currentMonthExpenses,
        landlordRemittance: currentMonth.collected - currentMonth.collected * mandateRate - currentMonthExpenses,
      }
      : undefined;
  const manager = mandateRow?.assignedPmId
    ? {
      id: mandateRow.assignedPmId,
      name: mandateRow.managerName,
      title: mandateRow.managerTitle,
      email: mandateRow.managerEmail,
      avatarUrl: mandateRow.managerAvatarUrl,
    }
    : null;
  const mandate = mandateRow
    ? {
      id: mandateRow.id,
      status: mandateRow.status,
      mandateRate,
      startDate: toISOStringSafe(mandateRow.startDate) || "",
      pendingApproverRole,
      approvalRequestId: pendingApprovalRequestId,
      currentPeriod,
      manager,
    }
    : null;

  return {
    ...prop,
    owner,
    mandate,
    collections,
    arrears,
    leases: leaseSummaries,
    maintenanceRequests: maintenanceRows.map((m) => ({
      id: m.id,
      title: m.title,
      reportedAt: toISOStringSafe(m.createdAt) || "",
      reportedBy: m.reportedBy ?? undefined,
      priority: m.priority,
      status: m.status,
    })),
    salesPipeline,
    documents: documentSummaries,
    vacantSince,
  };
}

/**
 * A property's real activity isn't just its own create/update/delete rows -
 * mandate decisions, lease signings/renewals/terminations, maintenance
 * reports, and document uploads are each written against THEIR OWN entity
 * (associatedType "property_mandate"/"lease"/"maintenance_request"/
 * "document"), never the property directly. A naive
 * associatedType=property,associatedId=X query misses all of that. This
 * looks up every related entity's id for this property and reads them all
 * in one merged, actor-named, chronologically-ordered feed.
 */
export async function listPropertyActivity(
  ctx: CallerContext,
  propertyId: string,
  filters: { limit?: number; offset?: number } = {},
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);

  const [prop] = await db.select({ ownerContactId: properties.ownerContactId }).from(properties).where(eq(properties.id, propertyId)).limit(1);
  if (!prop) throw new NotFoundError("Property not found");

  const [mandateRows, leaseRows, maintenanceRows, documentRows] = await Promise.all([
    db.select({ id: propertyMandates.id }).from(propertyMandates).where(eq(propertyMandates.propertyId, propertyId)),
    db.select({ id: leases.id }).from(leases).where(eq(leases.propertyId, propertyId)),
    db.select({ id: maintenanceRequests.id }).from(maintenanceRequests).where(eq(maintenanceRequests.propertyId, propertyId)),
    db
      .select({ id: documents.id })
      .from(documents)
      .where(
        prop.ownerContactId
          ? or(eq(documents.propertyId, propertyId), eq(documents.ownerContactId, prop.ownerContactId))
          : eq(documents.propertyId, propertyId),
      ),
  ]);

  return listAuditLog(ctx, {
    entityId,
    limit: filters.limit,
    offset: filters.offset,
    associatedGroups: [
      { type: "property", ids: [propertyId] },
      { type: "property_mandate", ids: mandateRows.map((r) => r.id) },
      { type: "lease", ids: leaseRows.map((r) => r.id) },
      { type: "maintenance_request", ids: maintenanceRows.map((r) => r.id) },
      { type: "document", ids: documentRows.map((r) => r.id) },
    ],
  });
}

// ─── Leases ──────────────────────────────────────────────────────────────────

export async function listLeases(ctx: CallerContext) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.lease.read", entityId);

  const rows = await db
    .select({
      id: leases.id,
      entityId: leases.entityId,
      propertyId: leases.propertyId,
      tenantContactId: leases.tenantContactId,
      startsAt: leases.startsAt,
      endsAt: leases.endsAt,
      monthlyRentKes: leases.monthlyRentKes,
      depositKes: leases.depositKes,
      isActive: leases.isActive,
      createdAt: leases.createdAt,
      updatedAt: leases.updatedAt,
      propertyName: properties.name,
      propertyCode: properties.propertyCode,
      propertyType: properties.propertyType,
      tenantName: contacts.displayName,
      tenantEmail: contacts.email,
      tenantPhone: contacts.phone,
      tenantAvatarUrl: contacts.avatarUrl,
      propertyMedia: properties.media,
      // Same in-flight-mandate join as listProperties:70-78 - surfaces the
      // property's manager on the lease row so the Leases hero card can show
      // a manager mini-card without a second fetch.
      managerId: propertyMandates.assignedPmId,
      managerName: users.name,
      managerAvatarUrl: users.avatarUrl,
    })
    .from(leases)
    .innerJoin(properties, eq(leases.propertyId, properties.id))
    .innerJoin(contacts, eq(leases.tenantContactId, contacts.id))
    .leftJoin(
      propertyMandates,
      and(
        eq(propertyMandates.propertyId, properties.id),
        inArray(propertyMandates.status, ["pending_approval", "active"]),
      ),
    )
    .leftJoin(users, eq(users.id, propertyMandates.assignedPmId))
    .where(eq(leases.entityId, entityId));

  const activeIds = rows.filter((l) => l.isActive).map((l) => l.id);
  if (activeIds.length === 0) return rows.map((l) => ({ ...l, balanceKes: 0 }));

  // Current-month collected-vs-expected balance per lease, same "fetch then
  // reduce" pattern already used for property/mandate arrears - no formal
  // rental_ledger table exists yet (SUNLAND_ERP_IMPLEMENTATION_SPEC.md §5.3
  // records it as designed-but-unbuilt), so this is computed live from the
  // same transactions rows the ledger would eventually be derived from.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodTx = await db
    .select({ leaseId: transactions.leaseId, amountKes: transactions.amountKes })
    .from(transactions)
    .where(and(inArray(transactions.leaseId, activeIds), eq(transactions.type, "rent"), gte(transactions.occurredAt, monthStart)));

  return rows.map((l) => {
    if (!l.isActive) return { ...l, balanceKes: 0 };
    const collected = periodTx.filter((t) => t.leaseId === l.id).reduce((sum, t) => sum + parseFloat(t.amountKes), 0);
    return { ...l, balanceKes: Math.max(0, parseFloat(l.monthlyRentKes) - collected) };
  });
}

export async function getLeaseById(ctx: CallerContext, leaseId: string) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.lease.read", entityId);

  const [lease] = await db
    .select({
      id: leases.id,
      entityId: leases.entityId,
      propertyId: leases.propertyId,
      tenantContactId: leases.tenantContactId,
      startsAt: leases.startsAt,
      endsAt: leases.endsAt,
      monthlyRentKes: leases.monthlyRentKes,
      depositKes: leases.depositKes,
      isActive: leases.isActive,
      createdAt: leases.createdAt,
      updatedAt: leases.updatedAt,
      propertyName: properties.name,
      propertyCode: properties.propertyCode,
      propertyType: properties.propertyType,
      propertyLocation: properties.location,
      propertyAskingPrice: properties.askingPriceKes,
      tenantName: contacts.displayName,
      tenantEmail: contacts.email,
      tenantPhone: contacts.phone,
    })
    .from(leases)
    .innerJoin(properties, eq(leases.propertyId, properties.id))
    .innerJoin(contacts, eq(leases.tenantContactId, contacts.id))
    .where(and(eq(leases.id, leaseId), eq(leases.entityId, entityId)))
    .limit(1);

  if (!lease) throw new NotFoundError("Lease not found");

  return lease;
}

export async function terminateLease(ctx: CallerContext, leaseId: string) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.lease.write", entityId);

  return db.transaction(async (tx) => {
    // 1. Fetch lease
    const [lease] = await tx
      .select()
      .from(leases)
      .where(and(eq(leases.id, leaseId), eq(leases.entityId, entityId)))
      .limit(1);

    if (!lease) throw new NotFoundError("Lease not found");
    if (!lease.isActive) {
      throw new DomainValidationError("Lease is already terminated.");
    }

    // 2. Set lease to inactive
    const [updatedLease] = await tx
      .update(leases)
      .set({ isActive: false })
      .where(eq(leases.id, leaseId))
      .returning();

    // 3. Update the associated property's status back to "available"
    const [updatedProp] = await tx
      .update(properties)
      .set({ status: "available" })
      .where(eq(properties.id, lease.propertyId))
      .returning();

    await writeAudit(tx, ctx, {
      action: "properties.lease.terminate",
      associatedType: "lease",
      associatedId: lease.id,
      summary: `Terminated lease agreement for property ${updatedProp?.name ?? lease.propertyId}`,
      entityId,
      before: lease,
      after: { lease: updatedLease, propertyStatus: updatedProp?.status },
    });

    return updatedLease;
  });
}

export async function createLease(
  ctx: CallerContext,
  input: {
    propertyId: string;
    tenantContactId: string;
    startsAt: string;
    endsAt: string;
    monthlyRentKes: string;
    depositKes?: string | null;
  }
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.lease.write", entityId);

  return db.transaction(async (tx) => {
    // 1. Fetch and verify property is available
    const [prop] = await tx
      .select()
      .from(properties)
      .where(and(eq(properties.id, input.propertyId), eq(properties.entityId, entityId)))
      .limit(1);

    if (!prop) throw new NotFoundError("Property not found");
    if (prop.status === "occupied") {
      throw new DomainValidationError("Property unit is already occupied by another active lease.");
    }

    // 2. Insert lease record
    const [inserted] = await tx
      .insert(leases)
      .values({
        entityId,
        propertyId: input.propertyId,
        tenantContactId: input.tenantContactId,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        monthlyRentKes: input.monthlyRentKes,
        depositKes: input.depositKes ?? null,
        isActive: true,
      })
      .returning();

    // 3. Flip unit status to occupied - guarded by status != occupied so a
    // concurrent lease on the same property can't both succeed (closes the
    // race between the check above and this write, same pattern used in
    // decideApprovalRequest).
    const [updatedProp] = await tx
      .update(properties)
      .set({ status: "occupied" })
      .where(and(eq(properties.id, input.propertyId), ne(properties.status, "occupied")))
      .returning();

    if (!updatedProp) {
      throw new ConflictError("Property unit is already occupied by another active lease.");
    }

    await writeAudit(tx, ctx, {
      action: "properties.lease.create",
      associatedType: "lease",
      associatedId: inserted.id,
      summary: `Created lease for tenant on property ${prop.name}`,
      entityId,
      before: null,
      after: { lease: inserted, propertyStatus: updatedProp.status },
    });

    return inserted;
  });
}

export async function updateLease(
  ctx: CallerContext,
  leaseId: string,
  input: {
    startsAt?: string;
    endsAt?: string;
    monthlyRentKes?: string;
    depositKes?: string | null;
  }
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.lease.write", entityId);

  const [existing] = await db
    .select()
    .from(leases)
    .where(and(eq(leases.id, leaseId), eq(leases.entityId, entityId)))
    .limit(1);
  if (!existing) throw new NotFoundError("Lease not found");

  // Explicit whitelist - property/tenant are fixed for the life of a lease;
  // reassigning either is a new lease (or a renewal), not an edit.
  const updatable: Partial<typeof leases.$inferInsert> = {};
  if (input.startsAt !== undefined) updatable.startsAt = new Date(input.startsAt);
  if (input.endsAt !== undefined) updatable.endsAt = new Date(input.endsAt);
  if (input.monthlyRentKes !== undefined) updatable.monthlyRentKes = input.monthlyRentKes;
  if (input.depositKes !== undefined) updatable.depositKes = input.depositKes;

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(leases)
      .set({ ...updatable, updatedAt: new Date() })
      .where(eq(leases.id, leaseId))
      .returning();

    await writeAudit(tx, ctx, {
      action: "properties.lease.update",
      associatedType: "lease",
      associatedId: leaseId,
      summary: "Updated lease terms",
      entityId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

export async function renewLease(
  ctx: CallerContext,
  leaseId: string,
  input: {
    endsAt: string;
    monthlyRentKes?: string;
    depositKes?: string | null;
  }
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.lease.write", entityId);

  const [existing] = await db
    .select()
    .from(leases)
    .where(and(eq(leases.id, leaseId), eq(leases.entityId, entityId)))
    .limit(1);
  if (!existing) throw new NotFoundError("Lease not found");
  if (!existing.isActive) throw new DomainValidationError("Only an active lease can be renewed.");

  return db.transaction(async (tx) => {
    await tx.update(leases).set({ isActive: false, updatedAt: new Date() }).where(eq(leases.id, leaseId));

    // New term picks up exactly where the old one ends - carries the same
    // property/tenant, and the property never leaves "occupied" since one
    // active lease is replaced by another in the same transaction (skips
    // createLease's availability guard, which would otherwise reject a
    // property that's already occupied by the lease being renewed).
    const [renewed] = await tx
      .insert(leases)
      .values({
        entityId,
        propertyId: existing.propertyId,
        tenantContactId: existing.tenantContactId,
        startsAt: existing.endsAt,
        endsAt: new Date(input.endsAt),
        monthlyRentKes: input.monthlyRentKes ?? existing.monthlyRentKes,
        depositKes: input.depositKes !== undefined ? input.depositKes : existing.depositKes,
        isActive: true,
      })
      .returning();

    await writeAudit(tx, ctx, {
      action: "properties.lease.renew",
      associatedType: "lease",
      associatedId: renewed.id,
      summary: `Renewed lease - new term starts ${toISOStringSafe(existing.endsAt)?.slice(0, 10) || ""}`,
      entityId,
      before: existing,
      after: renewed,
    });

    return renewed;
  });
}

// ─── Digitized Documents ──────────────────────────────────────────────────────

export async function listDocuments(
  ctx: CallerContext,
  filters: {
    ownerContactId?: string;
    propertyId?: string;
    leaseId?: string;
    type?: typeof documents.type.enumValues[number];
  } = {}
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);

  // Require broad crm.contact.read to view digitized files
  await authorize(ctx, "crm.contact.read", entityId);

  let conditions: SQL | undefined = eq(documents.entityId, entityId);
  if (filters.ownerContactId) {
    conditions = and(conditions, eq(documents.ownerContactId, filters.ownerContactId));
  }
  if (filters.propertyId) {
    conditions = and(conditions, eq(documents.propertyId, filters.propertyId));
  }
  if (filters.leaseId) {
    conditions = and(conditions, eq(documents.leaseId, filters.leaseId));
  }
  if (filters.type) {
    conditions = and(conditions, eq(documents.type, filters.type));
  }

  return db.select().from(documents).where(conditions).orderBy(desc(documents.createdAt));
}

export async function createDocument(
  ctx: CallerContext,
  input: {
    type: typeof documents.type.enumValues[number];
    title: string;
    fileUrl: string;
    ownerContactId?: string | null;
    propertyId?: string | null;
    leaseId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "crm.contact.write", entityId);

  if (!input.title || !input.fileUrl) {
    throw new DomainValidationError("Document title and fileUrl are required.");
  }

  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(documents)
      .values({
        entityId,
        type: input.type,
        title: input.title,
        fileUrl: input.fileUrl,
        uploadedById: ctx.user.id,
        ownerContactId: input.ownerContactId ?? null,
        propertyId: input.propertyId ?? null,
        leaseId: input.leaseId ?? null,
        metadata: input.metadata ?? {},
      })
      .returning();

    await writeAudit(tx, ctx, {
      action: "documents.upload",
      associatedType: "document",
      associatedId: inserted.id,
      summary: `Uploaded and cataloged digitized document: ${inserted.title} (${inserted.type})`,
      entityId,
      before: null,
      after: inserted,
    });

    return inserted;
  });
}
