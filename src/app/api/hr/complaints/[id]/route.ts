import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { getComplaint } from "@/lib/services/complaints";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireCallerContext(undefined, request);
    const complaint = await getComplaint(ctx, id);

    return NextResponse.json({ complaint });
  } catch (error) {
    return handleRouteError(error);
  }
}
