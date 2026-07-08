import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { markNotificationRead } from "@/lib/services/notifications";
import { requireCallerContext } from "@/lib/services/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireCallerContext(undefined, request);
    const notification = await markNotificationRead(ctx, id);

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    return handleRouteError(error);
  }
}
