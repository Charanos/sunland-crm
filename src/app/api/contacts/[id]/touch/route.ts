import { NextResponse } from "next/server";
import { DomainValidationError, handleRouteError } from "@/lib/authz/errors";
import { logContactTouch, type ContactTouchChannel } from "@/lib/services/crm";
import { requireCallerContext } from "@/lib/services/types";

const VALID_CHANNELS: ContactTouchChannel[] = ["call", "email", "whatsapp"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const entityId = body.entityId ?? null;
    const channel = body.channel as ContactTouchChannel;
    if (!VALID_CHANNELS.includes(channel)) {
      throw new DomainValidationError("channel must be one of call, email, whatsapp");
    }

    const ctx = await requireCallerContext(entityId, request);
    const result = await logContactTouch(ctx, id, channel);

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
