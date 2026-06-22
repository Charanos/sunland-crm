import { db } from "@/db";
import { approvalRequests, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";

    // Fetch pending approval requests with requester details
    const requests = await db
      .select({
        id: approvalRequests.id,
        entityId: approvalRequests.entityId,
        requestType: approvalRequests.requestType,
        relatedTable: approvalRequests.relatedTable,
        relatedId: approvalRequests.relatedId,
        requestedById: approvalRequests.requestedById,
        requestedByName: users.name,
        requestedAt: approvalRequests.requestedAt,
        amountKes: approvalRequests.amountKes,
        requiredApproverRole: approvalRequests.requiredApproverRole,
        status: approvalRequests.status,
        decisionNotes: approvalRequests.decisionNotes,
      })
      .from(approvalRequests)
      .innerJoin(users, eq(approvalRequests.requestedById, users.id))
      .where(eq(approvalRequests.status, status as any))
      .orderBy(desc(approvalRequests.requestedAt));

    return NextResponse.json({ requests });
  } catch (error: any) {
    console.error("GET Approvals Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
