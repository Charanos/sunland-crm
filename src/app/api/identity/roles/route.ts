import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { createRole, listRoles } from "@/lib/services/identity/roles";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const roles = await listRoles(ctx);
    return NextResponse.json({ roles });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const body = await request.json();

    const role = await createRole(ctx, body);
    return NextResponse.json({ success: true, role });
  } catch (error) {
    return handleRouteError(error);
  }
}
