import { NextResponse } from "next/server";
import { DomainValidationError, handleRouteError } from "@/lib/authz/errors";
import { deleteProject, getProject, updateProject } from "@/lib/services/operations";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireCallerContext(undefined, request);
    const project = await getProject(ctx, id);

    return NextResponse.json({ project });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const ctx = await requireCallerContext(undefined, request);
    const project = await updateProject(ctx, id, body);

    return NextResponse.json({ success: true, project });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) throw new DomainValidationError("Project ID is required");

    const ctx = await requireCallerContext(undefined, request);
    await deleteProject(ctx, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
