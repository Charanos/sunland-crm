import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { getNotificationPrefs, updateNotificationPrefs } from "@/lib/services/notifications";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const prefs = await getNotificationPrefs(ctx);
    return NextResponse.json({ prefs });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const ctx = await requireCallerContext(undefined, request);
    const prefs = await updateNotificationPrefs(ctx, body);
    return NextResponse.json({ success: true, prefs });
  } catch (error) {
    return handleRouteError(error);
  }
}
