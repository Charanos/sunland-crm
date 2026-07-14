import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { entities, timestamps, users } from "@/db/schema/platform";

export const conversationType = pgEnum("conversation_type", ["dm", "channel"]);
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
    createdById: uuid("created_by_id").references(() => users.id).notNull(),
    ...timestamps,
  },
  (table) => ({
    entityTypeIdx: index("conversations_entity_type_idx").on(table.entityId, table.type),
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
