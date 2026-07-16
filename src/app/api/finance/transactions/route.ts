import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { listTransactions, recordTransaction } from "@/lib/services/finance/transactions";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;
    const leaseId = searchParams.get("leaseId") ?? undefined;

    const ctx = await requireCallerContext(entityId, request);
    const transactionsList = await listTransactions(ctx, { entityId: entityId ?? undefined, leaseId });

    return NextResponse.json({ transactions: transactionsList });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const body = await request.json();

    const result = await recordTransaction(ctx, body);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}
