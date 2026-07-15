import { NextResponse } from "next/server";
import { handleRouteError, NotFoundError } from "@/lib/authz/errors";
import { listAuditLog } from "@/lib/services/audit-log";
import { listRemittancesForMandate } from "@/lib/services/finance/remittances";
import { db } from "@/db";
import { leases, propertyMandates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
    const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined;

    const ctx = await requireCallerContext(entityId, request);

    const [mandate] = await db.select().from(propertyMandates).where(eq(propertyMandates.id, id)).limit(1);
    if (!mandate) throw new NotFoundError("Mandate not found");

    const [propertyLeases, remittances] = await Promise.all([
      db.select({ id: leases.id }).from(leases).where(eq(leases.propertyId, mandate.propertyId)),
      listRemittancesForMandate(ctx, id),
    ]);

    const entries = await listAuditLog(ctx, {
      entityId: mandate.entityId,
      associatedGroups: [
        { type: "property_mandate", ids: [id] },
        { type: "lease", ids: propertyLeases.map((l) => l.id) },
        { type: "remittance_advice", ids: remittances.map((r) => r.id) },
      ],
      limit,
      offset,
    });

    return NextResponse.json({ entries });
  } catch (error) {
    return handleRouteError(error);
  }
}
