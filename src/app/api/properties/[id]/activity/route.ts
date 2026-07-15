import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { listPropertyActivity } from "@/lib/services/properties";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
    const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined;

    const params = await context.params;
    const id = params.id;

    const ctx = await requireCallerContext(entityId, request);
    const entries = await listPropertyActivity(ctx, id, { limit, offset });

    return NextResponse.json({ entries });
  } catch (error) {
    return handleRouteError(error);
  }
}
