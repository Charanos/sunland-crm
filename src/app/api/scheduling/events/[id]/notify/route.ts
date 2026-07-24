import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { notifyEventRoleTiers } from "@/lib/services/scheduling";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const ctx = await requireCallerContext(undefined, request);
    const result = await notifyEventRoleTiers(ctx, id, body);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}
