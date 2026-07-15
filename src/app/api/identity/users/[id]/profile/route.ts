import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { updateUserProfile } from "@/lib/services/identity/users";
import { getManagerProfile } from "@/lib/services/mandates";
import { requireCallerContext } from "@/lib/services/types";

/**
 * Full stakeholder-profile read (mandates, collected YTD, activity) - a
 * different shape from the self-service PATCH below, which only ever
 * touches name/title/avatarUrl. Kept in this file since both operate on the
 * same "/identity/users/[id]/profile" resource.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const manager = await getManagerProfile(ctx, id);

    return NextResponse.json({ manager });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const { id } = await params;
    const body = await request.json();

    const user = await updateUserProfile(ctx, id, body);
    return NextResponse.json({ success: true, user });
  } catch (error) {
    return handleRouteError(error);
  }
}
