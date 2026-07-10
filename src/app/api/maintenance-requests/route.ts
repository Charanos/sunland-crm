import { NextResponse } from "next/server";
import { DomainValidationError, handleRouteError, NotFoundError } from "@/lib/authz/errors";
import { requireCallerContext } from "@/lib/services/types";
import { resolveEntityId } from "@/lib/services/entity";
import { authorize } from "@/lib/authz/can";
import { db } from "@/db";
import { maintenanceRequests, properties } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { writeAudit } from "@/lib/authz/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { propertyId, title, description, priority } = body;
    const entityId = body.entityId ?? null;

    if (!propertyId) throw new DomainValidationError("propertyId is required");
    if (!title) throw new DomainValidationError("title is required");
    if (!description) throw new DomainValidationError("description is required");

    const ctx = await requireCallerContext(entityId, request);
    if (!ctx.entityId) throw new DomainValidationError("entityId is required");
    const resolvedEntityId = await resolveEntityId(ctx.entityId);
    
    // Check permission to report maintenance (either property.write or maintenance.write)
    await authorize(ctx, "properties.property.write", resolvedEntityId);

    // Verify property exists
    const [property] = await db
      .select()
      .from(properties)
      .where(and(eq(properties.id, propertyId), eq(properties.entityId, resolvedEntityId)))
      .limit(1);

    if (!property) throw new NotFoundError("Property not found");

    const mappedPriority = priority === "urgent" ? "critical" : priority === "medium" ? "normal" : priority;

    const [inserted] = await db
      .insert(maintenanceRequests)
      .values({
        entityId: resolvedEntityId,
        propertyId,
        title,
        description,
        priority: mappedPriority || "normal",
        status: "open",
      })
      .returning();

    await db.transaction(async (tx) => {
      await writeAudit(tx, ctx, {
        action: "properties.maintenance.create",
        associatedType: "maintenance_request",
        associatedId: inserted.id,
        summary: `Reported maintenance issue "${title}" on property ${property.name}`,
        entityId: resolvedEntityId,
        before: null,
        after: inserted,
      });
    });

    return NextResponse.json({ success: true, maintenanceRequest: inserted });
  } catch (error) {
    return handleRouteError(error);
  }
}
