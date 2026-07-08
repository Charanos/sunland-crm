import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { grantUserRole } from "@/lib/services/identity/user-roles";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const { id } = await params;
    const body = await request.json();

    const grant = await grantUserRole(ctx, id, body);
    return NextResponse.json({ success: true, grant });
  } catch (error) {
    return handleRouteError(error);
  }
}
