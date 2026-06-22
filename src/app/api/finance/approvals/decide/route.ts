import { db } from "@/db";
import { approvalRequests, users, transactions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { requestId, status, decisionNotes } = body;

    if (!requestId || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid status decision" }, { status: 400 });
    }

    const session = await getCurrentUser();
    let decidedById = session?.id;

    if (!decidedById) {
      // Fallback: locate a user with ceo role in seed dataset
      const [usr] = await db
        .select()
        .from(users)
        .where(eq(users.role, "ceo"))
        .limit(1);
      decidedById = usr?.id;
    }

    if (!decidedById) {
      return NextResponse.json({ error: "User session not found and fallback failed" }, { status: 401 });
    }

    const [existingRequest] = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, requestId))
      .limit(1);

    if (!existingRequest) {
      return NextResponse.json({ error: "Approval request not found" }, { status: 404 });
    }

    if (existingRequest.status !== "pending") {
      return NextResponse.json({ error: "Approval request is already decided" }, { status: 400 });
    }

    // Update approval request
    const [updatedRequest] = await db
      .update(approvalRequests)
      .set({
        status: status as "approved" | "rejected",
        decidedById,
        decidedAt: new Date(),
        decisionNotes: decisionNotes || `Request was ${status} via dashboard.`,
      })
      .where(eq(approvalRequests.id, requestId))
      .returning();

    // Trigger transaction logging side-effect if approved
    if (status === "approved" && existingRequest.amountKes) {
      const amountStr = existingRequest.amountKes.toString();
      await db.insert(transactions).values({
        entityId: existingRequest.entityId,
        type: "expense", // remittances and expenses act as disbursements
        amountKes: amountStr,
        occurredAt: new Date(),
        recordedById: decidedById,
        notes: `Disbursement approved: ${existingRequest.requestType.toUpperCase()} - Ref: ${existingRequest.id.substring(0, 8)}`,
        metadata: {
          approvalRequestId: existingRequest.id,
          relatedTable: existingRequest.relatedTable,
          relatedId: existingRequest.relatedId,
        },
      });
    }

    return NextResponse.json({ success: true, request: updatedRequest });
  } catch (error: any) {
    console.error("POST Decide Approval Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
