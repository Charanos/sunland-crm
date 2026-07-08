import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { markConversationRead } from "@/lib/services/messaging";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireCallerContext(undefined, request);
    const result = await markConversationRead(ctx, id);

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
