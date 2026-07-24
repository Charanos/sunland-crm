import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { verifyTotpEnrollment } from "@/lib/services/identity/security";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ctx = await requireCallerContext(undefined, request);
    const result = await verifyTotpEnrollment(ctx, body);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
