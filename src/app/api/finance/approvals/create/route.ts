import { db } from "@/db";
import { approvalRequests, users, entities } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { entityId, requestType, relatedTable, relatedId, amountKes, requiredApproverRole } = body;

    if (!entityId || !requestType || !relatedTable || !relatedId || !requiredApproverRole) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const session = await getCurrentUser();
    let requestedById = session?.id;

    if (!requestedById) {
      // Fallback: locate a user with finance_officer role in seed dataset
      const [usr] = await db
        .select()
        .from(users)
        .where(eq(users.role, "finance_officer"))
        .limit(1);
      requestedById = usr?.id;
    }

    if (!requestedById) {
      return NextResponse.json({ error: "User session not found and fallback failed" }, { status: 401 });
    }

    // Resolve slug to UUID if a slug was provided
    let resolvedEntityId = entityId;
    if (["group", "commercial", "residential", "valuers"].includes(entityId)) {
      const [ent] = await db.select().from(entities).where(eq(entities.slug, entityId)).limit(1);
      if (ent) resolvedEntityId = ent.id;
    }

    const [newRequest] = await db
      .insert(approvalRequests)
      .values({
        entityId: resolvedEntityId,
        requestType,
        relatedTable,
        relatedId,
        requestedById,
        amountKes: amountKes ? amountKes.toString() : null,
        requiredApproverRole: requiredApproverRole as "gm" | "ceo" | "department_head",
        status: "pending",
      })
      .returning();

    return NextResponse.json({ success: true, request: newRequest });
  } catch (error: any) {
    console.error("POST Create Approval Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
