import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { setConversationArchived } from "@/lib/services/messaging";
import { requireCallerContext } from "@/lib/services/types";

// Per-user archive - hides the thread from your own inbox only.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const ctx = await requireCallerContext(undefined, request);
    const result = await setConversationArchived(ctx, id, body?.archived !== false);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}
