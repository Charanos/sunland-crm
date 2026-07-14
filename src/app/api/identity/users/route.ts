import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { createUser, listUsers } from "@/lib/services/identity/users";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const searchParams = new URL(request.url).searchParams;
    const entityId = searchParams.get("entityId") ?? undefined;
    const role = searchParams.get("role") ?? undefined;

    const users = await listUsers(ctx, { entityId, role });
    return NextResponse.json({ users });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const body = await request.json();

    const result = await createUser(ctx, body);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}
