import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { createChannel, listConversations } from "@/lib/services/messaging";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get("type");
    const type = typeParam === "dm" || typeParam === "channel" ? typeParam : undefined;

    const ctx = await requireCallerContext(undefined, request);
    const conversations = await listConversations(ctx, { type });

    return NextResponse.json({ conversations });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const channel = await createChannel(ctx, body);

    return NextResponse.json({ success: true, conversation: channel });
  } catch (error) {
    return handleRouteError(error);
  }
}
