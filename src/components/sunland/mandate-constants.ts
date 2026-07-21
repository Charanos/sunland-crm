// Shared, zero-server-dependency mandate-letter/document helpers - same
// convention as valuation-constants.ts, safe to import from client
// components. Centralizes the "is this specific mandate's paperwork on
// file" question so every surface (mandate file, property file, future
// paperwork queue) reads the same, correctly-scoped answer rather than each
// re-deriving its own `.some(d => d.type === "mandate_letter")` (which used
// to silently leak a landlord's OTHER properties' letters in via the
// owner-wide document OR-fallback - see docs/ARCHITECTURE_DECISIONS.md
// ADR-014 §14.4 addendum).

export type BadgeTone = "primary" | "neutral" | "success" | "warning" | "risk" | "data" | "brand";

export interface MandateLetterDoc {
  type?: string;
  propertyId?: string | null;
  url?: string;
  name?: string;
  createdAt?: string | null;
  fileSizeBytes?: number | null;
}

export function findMandateLetterDocument<T extends MandateLetterDoc>(
  documents: T[] | null | undefined,
  propertyId: string,
): T | undefined {
  return (documents ?? []).find((d) => d.type === "mandate_letter" && d.propertyId === propertyId);
}

export type MandateLetterStatus = "verified" | "pending_upload";

export function mandateLetterStatus(
  documents: MandateLetterDoc[] | null | undefined,
  propertyId: string,
): MandateLetterStatus {
  return findMandateLetterDocument(documents, propertyId) ? "verified" : "pending_upload";
}

export const MANDATE_LETTER_STATUS_META: Record<MandateLetterStatus, { label: string; tone: BadgeTone }> = {
  verified: { label: "Verified", tone: "success" },
  pending_upload: { label: "Pending Upload", tone: "warning" },
};

/**
 * A mandate either has a real acquisition-pipeline audit trail (a
 * `valuations` row whose `resultingMandateId` points at it) or it doesn't -
 * the ones that don't predate the pipeline and were onboarded directly.
 * This is a truthful label, not a fabricated one: no valuation history is
 * invented for legacy mandates, we just say plainly which bucket a mandate
 * is in.
 */
export function mandateOriginLabel(
  originValuation: { id: string; valuationCode: string } | null,
): { label: string; tone: BadgeTone; href?: string } {
  return originValuation
    ? { label: `Acquisition Pipeline · ${originValuation.valuationCode}`, tone: "primary", href: `/admin/valuations/${originValuation.id}` }
    : { label: "Legacy / Direct Onboarding", tone: "neutral" };
}
