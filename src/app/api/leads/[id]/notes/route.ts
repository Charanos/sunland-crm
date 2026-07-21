import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { addLeadNote } from "@/lib/services/leads";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const note = await addLeadNote(ctx, id, body);

    return NextResponse.json({ success: true, note });
  } catch (error) {
    return handleRouteError(error);
  }
}
