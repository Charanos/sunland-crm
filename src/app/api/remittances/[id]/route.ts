import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { decideRemittanceAdvice } from "@/lib/services/finance/remittances";
import { requireCallerContext } from "@/lib/services/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const ctx = await requireCallerContext(null, request);
    const remittance = await decideRemittanceAdvice(ctx, id, body);

    return NextResponse.json({ success: true, remittance });
  } catch (error) {
    return handleRouteError(error);
  }
}
