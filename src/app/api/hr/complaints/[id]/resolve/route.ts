import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { resolveComplaint } from "@/lib/services/complaints";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const ctx = await requireCallerContext(undefined, request);
    const complaint = await resolveComplaint(ctx, id, body);

    return NextResponse.json({ success: true, complaint });
  } catch (error) {
    return handleRouteError(error);
  }
}
