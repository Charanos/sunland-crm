import { NextResponse } from "next/server";
import { DomainValidationError, handleRouteError } from "@/lib/authz/errors";
import { createProperty, listProperties, updateProperty, deleteProperty } from "@/lib/services/properties";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;
    const ownerContactId = searchParams.get("ownerContactId") ?? undefined;

    const ctx = await requireCallerContext(entityId, request);
    const propertiesList = await listProperties(ctx, { ownerContactId });

    return NextResponse.json({ properties: propertiesList });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const property = await createProperty(ctx, body);

    return NextResponse.json({ success: true, property });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) throw new DomainValidationError("Property ID is required");

    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const property = await updateProperty(ctx, id, body);

    return NextResponse.json({ success: true, property });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const entityId = searchParams.get("entityId") ?? null;
    if (!id) throw new DomainValidationError("Property ID is required");

    const ctx = await requireCallerContext(entityId, request);
    await deleteProperty(ctx, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
