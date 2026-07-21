// Real DB contact_type enum (src/db/schema/crm.ts) - the board/form previously
// used an 11-value fictional union (property_owner, investor, developer,
// financial_institution, advocate, valuer, government_agency) that don't
// exist in Postgres; selecting any of them would throw a raw enum-violation
// error. This is the one true vocabulary, mirroring lead-constants.ts's role
// for the Sales Pipeline page.
export type ContactType = "landlord" | "tenant" | "buyer" | "seller" | "contractor" | "company" | "other";

export const CONTACT_TYPE_OPTIONS: ContactType[] = ["landlord", "tenant", "buyer", "seller", "contractor", "company", "other"];

export const TYPE_META: Record<ContactType, { label: string; pill: string }> = {
  landlord: { label: "Landlord", pill: "bg-indigo-50 text-indigo-700 border border-indigo-100" },
  tenant: { label: "Tenant", pill: "bg-cyan-50 text-cyan-700 border border-cyan-100" },
  buyer: { label: "Buyer", pill: "bg-blue-50 text-blue-700 border border-blue-100" },
  seller: { label: "Seller", pill: "bg-violet-50 text-violet-700 border border-violet-100" },
  contractor: { label: "Contractor", pill: "bg-rose-50 text-rose-700 border border-rose-100" },
  company: { label: "Company", pill: "bg-slate-100 text-slate-700 border border-slate-200" },
  other: { label: "Other", pill: "bg-slate-50 text-slate-500 border border-slate-150" },
};

// Mirrors the real deriveContactStatus() in src/lib/services/crm.ts - derived
// at read time from real signals (active lease/mandate, open leads), never a
// stored column, so this is presentation metadata only.
export type ContactCrmStatus = "Active Client" | "Hot Prospect" | "Prospect" | "New Contact";

export const STATUS_META: Record<ContactCrmStatus, { dot: string; pill: string }> = {
  "Active Client": { dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700" },
  "Hot Prospect": { dot: "bg-amber-500", pill: "bg-amber-50 text-amber-700" },
  Prospect: { dot: "bg-slate-400", pill: "bg-slate-100 text-slate-600" },
  "New Contact": { dot: "bg-slate-300", pill: "bg-slate-50 text-slate-500" },
};
