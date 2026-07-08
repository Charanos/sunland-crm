import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { getOrCreateDm } from "@/lib/services/messaging";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const conversation = await getOrCreateDm(ctx, body);

    return NextResponse.json({ success: true, conversation });
  } catch (error) {
    return handleRouteError(error);
  }
}
