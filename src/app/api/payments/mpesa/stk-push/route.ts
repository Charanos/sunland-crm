import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { initiateTenantPayment } from "@/lib/services/payments/mpesa";
import { requireCallerContext } from "@/lib/services/types";

// Scaffold only - see src/lib/services/payments/mpesa.ts. Rejects with a
// clear 4xx until real Daraja credentials are configured; never fabricates
// a successful STK push.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ctx = await requireCallerContext(null, request);
    const payment = await initiateTenantPayment(ctx, body);

    return NextResponse.json({ success: true, payment });
  } catch (error) {
    return handleRouteError(error);
  }
}
