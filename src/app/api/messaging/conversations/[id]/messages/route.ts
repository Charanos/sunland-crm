import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { listMessages, sendMessage } from "@/lib/services/messaging";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const before = searchParams.get("before") ?? undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;

    const ctx = await requireCallerContext(undefined, request);
    const messages = await listMessages(ctx, id, { before, limit });

    return NextResponse.json({ messages });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const ctx = await requireCallerContext(undefined, request);
    const message = await sendMessage(ctx, id, body);

    return NextResponse.json({ success: true, message });
  } catch (error) {
    return handleRouteError(error);
  }
}
