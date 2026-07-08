import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { listPermissions } from "@/lib/services/identity/roles";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const permissions = await listPermissions(ctx);
    return NextResponse.json({ permissions });
  } catch (error) {
    return handleRouteError(error);
  }
}
