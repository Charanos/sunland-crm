import Ably from "ably";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { conversationParticipants, users } from "@/db/schema";

let restClient: Ably.Rest | null = null;

export function getAblyRest() {
  if (restClient) {
    return restClient;
  }

  const key = process.env.ABLY_API_KEY;

  if (!key) {
    return null;
  }

  restClient = new Ably.Rest({ key });
  return restClient;
}

/**
 * Capability is scoped to exactly this user's own notification channel plus
 * the conversations they're actually a participant in at mint time - never
 * a blanket grant. Without this, any authenticated user could subscribe to
 * any guessed `conversation-{id}` channel name, since Ably channel names
 * aren't secret on their own.
 */
export async function getAblyToken(userId: string) {
  const ably = getAblyRest();

  if (!ably) {
    throw new Error("ABLY_API_KEY is not configured");
  }

  const [myConversations, [me]] = await Promise.all([
    db
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, userId)),
    db.select({ primaryEntityId: users.primaryEntityId }).from(users).where(eq(users.id, userId)).limit(1),
  ]);

  const capability: Record<string, Ably.capabilityOp[]> = {
    [`private-user-${userId}`]: ["subscribe"],
  };
  for (const { conversationId } of myConversations) {
    capability[`conversation-${conversationId}`] = ["subscribe"];
  }
  // Real "who's online" presence, scoped to the user's own entity channel -
  // powers the Directory/messages online dots without a fabricated status.
  if (me?.primaryEntityId) {
    capability[`presence-entity-${me.primaryEntityId}`] = ["subscribe", "presence"];
  }

  return ably.auth.createTokenRequest({ clientId: userId, capability });
}

/**
 * Server-side publish only - clients never publish directly. The DB row
 * inserted by the caller is the source of truth; this is a best-effort push
 * so an open tab updates live. Silently no-ops if Ably isn't configured,
 * since realtime delivery is a convenience layered on top of real persistence.
 */
export async function publishToChannel(channelName: string, eventName: string, data: unknown) {
  const ably = getAblyRest();
  if (!ably) return;

  const channel = ably.channels.get(channelName);
  await channel.publish(eventName, data);
}
