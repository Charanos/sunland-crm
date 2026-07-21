import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { entities, timestamps, users } from "@/db/schema/platform";
import { contacts, leads } from "@/db/schema/crm";
import { properties, leases } from "@/db/schema/properties";
import { valuations } from "@/db/schema/valuations";

export const documentType = pgEnum("document_type", [
  "mandate_letter",
  "lease_agreement",
  "rent_receipt",
  "statement",
  "title_deed",
  "identification",
  // Landlord-side offer-letter equivalent (ADR 014 §14.1) - uploadable today
  // via the generic documents API even though the Front Office workflow that
  // would normally formalize/track it isn't built.
  "offer_letter",
  // Valuation report attached to an acquisition-pipeline prospect (see
  // src/db/schema/valuations.ts).
  "valuation_report",
]);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    type: documentType("type").notNull(),
    title: text("title").notNull(),
    fileUrl: text("file_url").notNull(),
    uploadedById: uuid("uploaded_by_id").references(() => users.id).notNull(),
    ownerContactId: uuid("owner_contact_id").references(() => contacts.id),
    // Nullable - owner-level paperwork (ID, statements) has no property; a
    // title deed or lease agreement belongs to one. Lets the property full
    // view list exactly its own documents instead of everything the owner has.
    propertyId: uuid("property_id").references(() => properties.id),
    // Nullable - scopes lease-specific paperwork (the executed agreement,
    // rent receipts) to one tenancy so renewing a lease doesn't drag the old
    // tenancy's documents onto the new lease record.
    leaseId: uuid("lease_id").references(() => leases.id),
    // Nullable - scopes a valuation report/offer letter to one acquisition
    // prospect (src/db/schema/valuations.ts), same pattern as propertyId/leaseId.
    valuationId: uuid("valuation_id").references(() => valuations.id),
    // Nullable - scopes a Sales Pipeline deal's real attachments (SPA drafts,
    // ID copies, etc.) to one lead, same pattern as propertyId/leaseId/valuationId.
    leadId: uuid("lead_id").references(() => leads.id),
    // Captured at upload time - real, not a display-only estimate. Nullable
    // for documents uploaded before this column existed.
    fileSizeBytes: integer("file_size_bytes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    ...timestamps,
  },
  (table) => ({
    entityIdx: index("documents_entity_idx").on(table.entityId),
    ownerContactIdx: index("documents_owner_contact_idx").on(table.ownerContactId),
    propertyIdx: index("documents_property_idx").on(table.propertyId),
    leaseIdx: index("documents_lease_idx").on(table.leaseId),
    valuationIdx: index("documents_valuation_idx").on(table.valuationId),
    leadIdx: index("documents_lead_idx").on(table.leadId),
    typeIdx: index("documents_type_idx").on(table.type),
  }),
);

export const reportExports = pgTable(
  "report_exports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    reportType: text("report_type").notNull(),
    generatedById: uuid("generated_by_id").references(() => users.id).notNull(),
    verificationToken: text("verification_token").unique().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    ...timestamps,
  },
  (table) => ({
    entityIdx: index("report_exports_entity_idx").on(table.entityId),
    tokenIdx: index("report_exports_token_idx").on(table.verificationToken),
  }),
);
