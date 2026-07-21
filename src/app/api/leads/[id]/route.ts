import { NextResponse } from "next/server";
import { DomainValidationError, handleRouteError } from "@/lib/authz/errors";
import { deleteLead, getLead, transitionLeadStage, updateLead } from "@/lib/services/leads";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const lead = await getLead(ctx, id);

    return NextResponse.json({ lead });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const ctx = await requireCallerContext(null, request);

    if (body.action === "transition") {
      const lead = await transitionLeadStage(ctx, id, body);
      return NextResponse.json({ success: true, lead });
    }

    if (body.action === "update" || !body.action) {
      const lead = await updateLead(ctx, id, body);
      return NextResponse.json({ success: true, lead });
    }

    throw new DomainValidationError(`Unsupported action: ${body.action}`);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const result = await deleteLead(ctx, id);

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
