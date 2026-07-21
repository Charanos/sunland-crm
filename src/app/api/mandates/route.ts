import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { createMandate, getMandatesSummary, listMandates } from "@/lib/services/mandates";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;
    const propertyId = searchParams.get("propertyId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const paperworkStatus = (searchParams.get("paperworkStatus") as "verified" | "pending_upload" | null) ?? undefined;
    const search = searchParams.get("search") ?? undefined;
    const includeFinancials = searchParams.get("includeFinancials") === "1";
    const includeSummary = searchParams.get("includeSummary") === "1";

    const ctx = await requireCallerContext(entityId, request);
    const mandates = await listMandates(ctx, { propertyId, status, paperworkStatus, search, includeFinancials });
    const summary = includeSummary ? await getMandatesSummary(ctx) : undefined;

    return NextResponse.json({ mandates, summary });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const mandate = await createMandate(ctx, body);

    return NextResponse.json({ success: true, mandate });
  } catch (error) {
    return handleRouteError(error);
  }
}
