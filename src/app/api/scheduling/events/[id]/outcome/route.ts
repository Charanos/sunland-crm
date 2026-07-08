import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { setEventOutcome } from "@/lib/services/scheduling";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const ctx = await requireCallerContext(undefined, request);
    const event = await setEventOutcome(ctx, id, body);

    return NextResponse.json({ success: true, event });
  } catch (error) {
    return handleRouteError(error);
  }
}
