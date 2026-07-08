import { NextResponse } from "next/server";
import { DomainValidationError, handleRouteError } from "@/lib/authz/errors";
import { createComplaint, listComplaints } from "@/lib/services/complaints";
import { requireCallerContext } from "@/lib/services/types";

const VALID_TABS = ["my-queue", "escalated", "resolved"] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;
    const tabParam = searchParams.get("tab");
    const tab = VALID_TABS.includes(tabParam as (typeof VALID_TABS)[number])
      ? (tabParam as (typeof VALID_TABS)[number])
      : "my-queue";

    const ctx = await requireCallerContext(entityId, request);
    const complaints = await listComplaints(ctx, { entityId: entityId ?? undefined, tab });

    return NextResponse.json({ complaints });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entityId = body.entityId ?? null;
    if (!entityId) throw new DomainValidationError("entityId is required");

    const ctx = await requireCallerContext(entityId, request);
    const complaint = await createComplaint(ctx, body);

    return NextResponse.json({ success: true, complaint });
  } catch (error) {
    return handleRouteError(error);
  }
}
