import { NextResponse } from "next/server";
import { DomainValidationError, handleRouteError } from "@/lib/authz/errors";
import { terminateMandate } from "@/lib/services/mandates";
import { requireCallerContext } from "@/lib/services/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body.action !== "terminate") {
      throw new DomainValidationError(`Unsupported action: ${body.action}`);
    }

    const ctx = await requireCallerContext(null, request);
    const mandate = await terminateMandate(ctx, id, body);

    return NextResponse.json({ success: true, mandate });
  } catch (error) {
    return handleRouteError(error);
  }
}
