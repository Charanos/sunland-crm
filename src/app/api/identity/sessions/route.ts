import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { listSessions } from "@/lib/services/identity/sessions";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const userId = new URL(request.url).searchParams.get("userId") ?? undefined;

    const sessions = await listSessions(ctx, userId);
    return NextResponse.json({ sessions });
  } catch (error) {
    return handleRouteError(error);
  }
}
