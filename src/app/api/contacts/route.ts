import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { createContact, listContacts } from "@/lib/services/crm";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;
    const type = (searchParams.get("type") as "landlord" | "tenant" | "contractor" | null) ?? undefined;
    const search = searchParams.get("search") ?? undefined;

    const ctx = await requireCallerContext(entityId, request);
    const contacts = await listContacts(ctx, { type, search });

    return NextResponse.json({ contacts });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const contact = await createContact(ctx, body);

    return NextResponse.json({ success: true, contact });
  } catch (error) {
    return handleRouteError(error);
  }
}
