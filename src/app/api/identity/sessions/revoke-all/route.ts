import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { revokeAllOtherSessions } from "@/lib/services/identity/sessions";
import { getCurrentSessionId } from "@/lib/auth/session";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const currentSessionId = await getCurrentSessionId();
    const result = await revokeAllOtherSessions(ctx, currentSessionId);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
