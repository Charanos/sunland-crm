import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { createLead, listLeads } from "@/lib/services/leads";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;
    const stage = searchParams.get("stage") ?? undefined;
    const assignedToId = searchParams.get("assignedToId") ?? undefined;
    const search = searchParams.get("search") ?? undefined;

    const ctx = await requireCallerContext(entityId, request);
    const leads = await listLeads(ctx, { stage, assignedToId, search });

    return NextResponse.json({ leads });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const lead = await createLead(ctx, body);

    return NextResponse.json({ success: true, lead });
  } catch (error) {
    return handleRouteError(error);
  }
}
