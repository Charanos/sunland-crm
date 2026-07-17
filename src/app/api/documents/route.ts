import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { createDocument, listDocuments } from "@/lib/services/properties";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;
    const ownerContactId = searchParams.get("ownerContactId") ?? undefined;
    const propertyId = searchParams.get("propertyId") ?? undefined;
    const leaseId = searchParams.get("leaseId") ?? undefined;
    const valuationId = searchParams.get("valuationId") ?? undefined;
    const type = (searchParams.get("type") as "mandate_letter" | "lease_agreement" | "rent_receipt" | "statement" | "valuation_report" | "offer_letter" | "identification" | "title_deed" | null) ?? undefined;

    const ctx = await requireCallerContext(entityId, request);
    const documentsList = await listDocuments(ctx, { ownerContactId, propertyId, leaseId, valuationId, type });

    return NextResponse.json({ documents: documentsList });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const document = await createDocument(ctx, body);

    return NextResponse.json({ success: true, document });
  } catch (error) {
    return handleRouteError(error);
  }
}
