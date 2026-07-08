import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { updateUserAccess } from "@/lib/services/identity/users";
import { requireCallerContext } from "@/lib/services/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const { id } = await params;
    const body = await request.json();

    const user = await updateUserAccess(ctx, id, body);
    return NextResponse.json({ success: true, user });
  } catch (error) {
    return handleRouteError(error);
  }
}
