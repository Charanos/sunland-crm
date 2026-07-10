import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { verifyContact } from "@/lib/services/crm";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const contact = await verifyContact(ctx, id, { idNumber: body.idNumber });

    return NextResponse.json({ success: true, contact });
  } catch (error) {
    return handleRouteError(error);
  }
}
