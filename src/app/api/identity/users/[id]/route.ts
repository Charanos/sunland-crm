import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { getUser } from "@/lib/services/identity/users";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const { id } = await params;

    const user = await getUser(ctx, id);
    return NextResponse.json({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}
