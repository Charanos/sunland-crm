import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { createProject, listProjects } from "@/lib/services/operations";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;
    const department = searchParams.get("department") ?? undefined;
    const status = searchParams.get("status") ?? undefined;

    const ctx = await requireCallerContext(entityId, request);
    const projects = await listProjects(ctx, { entityId: entityId ?? undefined, department, status });

    return NextResponse.json({ projects });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const project = await createProject(ctx, body);

    return NextResponse.json({ success: true, project });
  } catch (error) {
    return handleRouteError(error);
  }
}
