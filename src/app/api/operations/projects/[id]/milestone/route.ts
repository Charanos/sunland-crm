import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { toggleMilestone } from "@/lib/services/operations";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const ctx = await requireCallerContext(undefined, request);
    const project = await toggleMilestone(ctx, id, body);

    return NextResponse.json({ success: true, project });
  } catch (error) {
    return handleRouteError(error);
  }
}
