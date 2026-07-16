import { NextResponse } from "next/server";
import { DomainValidationError, handleRouteError } from "@/lib/authz/errors";
import { assignMandateManager, getMandateWithDetails, terminateMandate, updateMandateTerms } from "@/lib/services/mandates";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const mandate = await getMandateWithDetails(ctx, id);

    return NextResponse.json({ mandate });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const ctx = await requireCallerContext(null, request);

    if (body.action === "terminate") {
      const mandate = await terminateMandate(ctx, id, body);
      return NextResponse.json({ success: true, mandate });
    }

    if (body.action === "assign_manager") {
      const mandate = await assignMandateManager(ctx, id, body);
      return NextResponse.json({ success: true, mandate });
    }

    if (body.action === "update_terms") {
      const mandate = await updateMandateTerms(ctx, id, body);
      return NextResponse.json({ success: true, mandate });
    }

    throw new DomainValidationError(`Unsupported action: ${body.action}`);
  } catch (error) {
    return handleRouteError(error);
  }
}
