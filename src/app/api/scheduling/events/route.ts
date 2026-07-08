import { NextResponse } from "next/server";
import { DomainValidationError, handleRouteError } from "@/lib/authz/errors";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
} from "@/lib/services/scheduling";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;
    const startDate = searchParams.get("startDate") ?? undefined;
    const endDate = searchParams.get("endDate") ?? undefined;
    const scope = searchParams.get("scope") === "all" ? "all" : "mine";

    const ctx = await requireCallerContext(entityId, request);
    const events = await listCalendarEvents(ctx, { entityId: entityId ?? undefined, startDate, endDate, scope });

    return NextResponse.json({ events });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const event = await createCalendarEvent(ctx, body);

    return NextResponse.json({ success: true, event });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) throw new DomainValidationError("Calendar event ID is required");

    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const event = await updateCalendarEvent(ctx, id, body);

    return NextResponse.json({ success: true, event });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const entityId = searchParams.get("entityId") ?? null;
    if (!id) throw new DomainValidationError("Calendar event ID is required");

    const ctx = await requireCallerContext(entityId, request);
    await deleteCalendarEvent(ctx, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
