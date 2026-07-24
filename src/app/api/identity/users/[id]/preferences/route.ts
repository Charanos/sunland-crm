import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { getUserPreferences, upsertUserPreferences } from "@/lib/services/identity/preferences";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireCallerContext(undefined, request);
    const preferences = await getUserPreferences(ctx, id);
    return NextResponse.json({ preferences });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const ctx = await requireCallerContext(undefined, request);
    const result = await upsertUserPreferences(ctx, id, body);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
