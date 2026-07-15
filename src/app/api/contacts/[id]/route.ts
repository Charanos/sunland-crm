import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { getContactProfile } from "@/lib/services/crm";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const contact = await getContactProfile(ctx, id);

    return NextResponse.json({ contact });
  } catch (error) {
    return handleRouteError(error);
  }
}
