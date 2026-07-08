import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { deleteRole } from "@/lib/services/identity/roles";
import { requireCallerContext } from "@/lib/services/types";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const { id } = await params;

    const result = await deleteRole(ctx, id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}
