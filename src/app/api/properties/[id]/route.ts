import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { getPropertyWithDetails } from "@/lib/services/properties";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;
    
    // Support both Next 14 and Next 15 params API
    const params = await context.params;
    const id = params.id;
    
    const ctx = await requireCallerContext(entityId, request);
    const property = await getPropertyWithDetails(ctx, id);

    return NextResponse.json({ property });
  } catch (error) {
    return handleRouteError(error);
  }
}
