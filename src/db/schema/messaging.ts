import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { entities, timestamps, users } from "@/db/schema/platform";

// "system" threads are produced by real ERP events (a remittance releasing, a
// maintenance work order changing state) - they are appended to by the
// services that own those events, never invented for display.
export const conversationType = pgEnum("conversation_type", ["dm", "channel", "system"]);
export const messageType = pgEnum("message_type", ["text", "system"]);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    type: conversationType("type").notNull(),
    // Only meaningful for channels - a dm's display name is derived
    // client-side from the other participant.
    name: text("name"),
    description: text("description"),
    // What this thread is about. Powers the inbox row's category badge and
    // record code, the thread header's linked-record strip, and its
    // "Open record" deep link. The code (e.g. WO-1188, RMT-0619) is
    // denormalised so the inbox list doesn't need a join per row.
    linkedRecordType: text("linked_record_type"),
    linkedRecordId: uuid("linked_record_id"),
    linkedRecordCode: text("linked_record_code"),
    createdById: uuid("created_by_id").references(() => users.id).notNull(),
    ...timestamps,
  },
  (table) => ({
    entityTypeIdx: index("conversations_entity_type_idx").on(table.entityId, table.type),
    linkedRecordIdx: index("conversations_linked_record_idx").on(table.linkedRecordType, table.linkedRecordId),
  }),
);

// Access control for messaging is participancy, not a granted permission -
// you see a conversation iff you have a row here for it.
export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").references(() => conversations.id).notNull(),
    userId: uuid("user_id").references(() => users.id).notNull(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    mutedAt: timestamp("muted_at", { withTimezone: true }),
    // Per-user archive - the thread header's archive button hides the thread
    // for you only, it does not touch anyone else's inbox.
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    conversationUserIdx: uniqueIndex("conversation_participants_conv_user_idx").on(
      table.conversationId,
      table.userId,
    ),
    userIdx: index("conversation_participants_user_idx").on(table.userId),
  }),
);

// Immutable log - no edit/soft-delete in this pass, so only createdAt, not
// the usual ...timestamps spread.
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").references(() => conversations.id).notNull(),
    senderId: uuid("sender_id").references(() => users.id).notNull(),
    content: text("content").notNull(),
    type: messageType("type").default("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    conversationCreatedIdx: index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    senderIdx: index("messages_sender_idx").on(table.senderId),
  }),
);
