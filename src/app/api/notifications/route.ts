import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { listNotifications, sendManualNotification } from "@/lib/services/notifications";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const ctx = await requireCallerContext(undefined, request);
    const items = await listNotifications(ctx, { unreadOnly });

    return NextResponse.json({ notifications: items });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const notification = await sendManualNotification(ctx, body);

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    return handleRouteError(error);
  }
}
