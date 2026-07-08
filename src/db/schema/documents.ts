import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { entities, timestamps, users } from "@/db/schema/platform";
import { contacts } from "@/db/schema/crm";

export const documentType = pgEnum("document_type", [
  "mandate_letter",
  "lease_agreement",
  "rent_receipt",
  "statement",
  "title_deed",
  "identification",
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
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    ...timestamps,
  },
  (table) => ({
    entityIdx: index("documents_entity_idx").on(table.entityId),
    ownerContactIdx: index("documents_owner_contact_idx").on(table.ownerContactId),
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
