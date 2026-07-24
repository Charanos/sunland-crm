import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { setProjectBoardState } from "@/lib/services/operations";
import { requireCallerContext } from "@/lib/services/types";

// Backs the Projects Board kanban drag - writes (status, atRisk) together,
// since the "At Risk" column is a flag on an in-progress project rather than
// its own lifecycle stage.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const ctx = await requireCallerContext(undefined, request);
    const project = await setProjectBoardState(ctx, id, body);

    return NextResponse.json({ success: true, project });
  } catch (error) {
    return handleRouteError(error);
  }
}
