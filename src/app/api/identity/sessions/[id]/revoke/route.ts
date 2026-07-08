import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { revokeSession } from "@/lib/services/identity/sessions";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const { id } = await params;

    const session = await revokeSession(ctx, id);
    return NextResponse.json({ success: true, session });
  } catch (error) {
    return handleRouteError(error);
  }
}
