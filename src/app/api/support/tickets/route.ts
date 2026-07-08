import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { createSupportTicket, listSupportTickets } from "@/lib/services/support";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;
    const scope = searchParams.get("scope") === "all" ? "all" : "mine";

    const ctx = await requireCallerContext(entityId, request);
    const tickets = await listSupportTickets(ctx, { entityId: entityId ?? undefined, scope });

    return NextResponse.json({ tickets });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const ticket = await createSupportTicket(ctx, body);

    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    return handleRouteError(error);
  }
}
