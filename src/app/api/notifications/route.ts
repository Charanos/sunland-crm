import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { listNotifications } from "@/lib/services/notifications";
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
