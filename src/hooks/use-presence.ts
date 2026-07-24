"use client";

import { useEffect, useState } from "react";
import * as Ably from "ably";

// Reuse the same shared realtime connection the chat hook opens (token-auth,
// server-scoped capability - see src/lib/realtime/ably.ts). Kept as its own
// module-level singleton mirror so importing either hook works standalone.
let sharedClient: Ably.Realtime | null = null;
function getClient(): Ably.Realtime {
  if (!sharedClient) {
    sharedClient = new Ably.Realtime({ authUrl: "/api/realtime/token" });
  }
  return sharedClient;
}

/**
 * Real "who's online" via Ably presence on a per-entity channel. Enters the
 * presence set for `selfId` and returns the live set of present member ids.
 * Degrades to an empty set (no dots) when Ably isn't configured - never
 * throws, matching useAblyChannel's convenience-layer contract.
 */
export function usePresence(entityId: string | null, selfId: string | null): Set<string> {
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!entityId || !selfId) return;
    let channel: Ably.RealtimeChannel | null = null;
    let cancelled = false;

    const refresh = async () => {
      try {
        if (!channel) return;
        const members = await channel.presence.get();
        if (cancelled) return;
        setOnline(new Set(members.map((m) => (typeof m.clientId === "string" ? m.clientId : "")).filter(Boolean)));
      } catch {
        // no-op - keep whatever we last had
      }
    };

    try {
      const client = getClient();
      channel = client.channels.get(`presence-entity-${entityId}`);
      channel.presence.subscribe(refresh);
      channel.presence.enter({ id: selfId }).then(refresh).catch(() => { });
    } catch {
      // No presence for this session - REST last-active still renders.
    }

    return () => {
      cancelled = true;
      try {
        channel?.presence.unsubscribe();
        channel?.presence.leave().catch(() => { });
      } catch {
        // ignore teardown errors
      }
    };
  }, [entityId, selfId]);

  return online;
}
