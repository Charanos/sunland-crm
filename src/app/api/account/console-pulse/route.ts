import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { getAccountConsolePulse } from "@/lib/services/account-console";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;
    const scope = searchParams.get("scope") === "org" ? "org" : "personal";
    const ctx = await requireCallerContext(entityId, request);
    const pulse = await getAccountConsolePulse(ctx, scope);
    return NextResponse.json({ pulse });
  } catch (error) {
    return handleRouteError(error);
  }
}
