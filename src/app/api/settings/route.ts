import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { getSettings, upsertSetting } from "@/lib/services/settings";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const entityId = new URL(request.url).searchParams.get("entityId") ?? undefined;

    const settings = await getSettings(ctx, entityId);
    return NextResponse.json({ settings });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const body = await request.json();

    const setting = await upsertSetting(ctx, body);
    return NextResponse.json({ success: true, setting });
  } catch (error) {
    return handleRouteError(error);
  }
}
