import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { addTicketMessage, listTicketMessages } from "@/lib/services/support";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireCallerContext(undefined, request);
    const messages = await listTicketMessages(ctx, id);

    return NextResponse.json({ messages });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** A real reply. The first staff reply stamps firstRespondedAt (the SLA clock). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const ctx = await requireCallerContext(undefined, request);
    const message = await addTicketMessage(ctx, id, body);

    return NextResponse.json({ success: true, message });
  } catch (error) {
    return handleRouteError(error);
  }
}
