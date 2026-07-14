"use client";

import { useEffect, useRef } from "react";
import * as Ably from "ably";

// One shared connection per tab rather than one per subscribing component -
// each open chat panel/widget would otherwise open its own websocket.
let sharedClient: Ably.Realtime | null = null;
function getClient(): Ably.Realtime {
  if (!sharedClient) {
    // Token-auth only - the server (src/lib/realtime/ably.ts) mints a
    // capability scoped to this user's own channels; the client never holds
    // the API key.
    sharedClient = new Ably.Realtime({ authUrl: "/api/realtime/token" });
  }
  return sharedClient;
}

/**
 * Subscribes to a single Ably event on a channel for the component's
 * lifetime. Realtime delivery here is additive convenience layered on top of
 * REST-persisted data (per the server-side publish comment in
 * src/lib/realtime/ably.ts) - a subscription failure (e.g. ABLY_API_KEY
 * unset) degrades to "no live updates," never a thrown error.
 */
export function useAblyChannel<T = unknown>(
  channelName: string | null,
  eventName: string,
  onMessage: (data: T) => void,
) {
  const callbackRef = useRef(onMessage);
  useEffect(() => {
    callbackRef.current = onMessage;
  });

  useEffect(() => {
    if (!channelName) return;

    let channel: Ably.RealtimeChannel | null = null;
    const handler = (msg: Ably.Message) => callbackRef.current(msg.data as T);

    try {
      const client = getClient();
      channel = client.channels.get(channelName);
      channel.subscribe(eventName, handler);
    } catch {
      // No live updates for this session - REST fetches remain correct.
    }

    return () => {
      channel?.unsubscribe(eventName, handler);
    };
  }, [channelName, eventName]);
}
