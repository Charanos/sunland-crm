import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { changePassword } from "@/lib/services/identity/security";
import { getCurrentSessionId } from "@/lib/auth/session";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ctx = await requireCallerContext(undefined, request);
    const currentSessionId = await getCurrentSessionId();
    const result = await changePassword(ctx, currentSessionId, body);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
