import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { listRolePermissions, updateRolePermissions } from "@/lib/services/identity/roles";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const { id } = await params;

    const permissions = await listRolePermissions(ctx, id);
    return NextResponse.json({ permissions: permissions.map((p) => p.key) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const { id } = await params;
    const body = await request.json();

    const result = await updateRolePermissions(ctx, id, body);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}
