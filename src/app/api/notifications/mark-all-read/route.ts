import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { markAllNotificationsRead } from "@/lib/services/notifications";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const result = await markAllNotificationsRead(ctx);

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
