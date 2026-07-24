import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { getSecurityOverview } from "@/lib/services/identity/security";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const overview = await getSecurityOverview(ctx);
    return NextResponse.json({ overview });
  } catch (error) {
    return handleRouteError(error);
  }
}
