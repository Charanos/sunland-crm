import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { generateRemittanceAdvice, listRemittancesForMandate } from "@/lib/services/finance/remittances";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const remittances = await listRemittancesForMandate(ctx, id);

    return NextResponse.json({ remittances });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const remittance = await generateRemittanceAdvice(ctx, id, body);

    return NextResponse.json({ success: true, remittance });
  } catch (error) {
    return handleRouteError(error);
  }
}
