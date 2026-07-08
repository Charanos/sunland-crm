import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { getSupportTicket, updateSupportTicket } from "@/lib/services/support";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireCallerContext(undefined, request);
    const ticket = await getSupportTicket(ctx, id);

    return NextResponse.json({ ticket });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const ctx = await requireCallerContext(undefined, request);
    const ticket = await updateSupportTicket(ctx, id, body);

    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    return handleRouteError(error);
  }
}
