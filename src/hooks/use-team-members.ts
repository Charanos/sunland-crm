"use client";

import { useEffect, useState } from "react";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
}

const QUICK_CHAT_LIMIT = 5;

/**
 * A short list of real colleagues for the sidebar's "quick message" section -
 * replaces what used to be a hardcoded 3-person mock roster. No presence
 * system exists yet, so this deliberately doesn't return an online/away
 * status; callers shouldn't fake one.
 */
export function useTeamMembers(entityId = "group") {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve().then(async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        const meData = await meRes.json();
        const selfId = meData?.user?.id ?? null;
        setCurrentUserId(selfId);

        const usersRes = await fetch(`/api/identity/users?entityId=${entityId}`);
        const usersData = await usersRes.json();
        if (Array.isArray(usersData.users)) {
          setMembers(
            usersData.users
              .filter((u: { id: string }) => u.id !== selfId)
              .slice(0, QUICK_CHAT_LIMIT),
          );
        }
      } catch {
        // Sidebar quick-chat list stays empty - Messages page remains the source of truth.
      }
    });
  }, [entityId]);

  return { members, currentUserId };
}

/** Resolves (creating if needed) the DM conversation id for a colleague, so nav quick-chat buttons open a real thread. */
export async function getOrCreateDmConversationId(entityId: string, otherUserId: string): Promise<string | null> {
  try {
    const res = await fetch("/api/messaging/conversations/dm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityId, otherUserId }),
    });
    const data = await res.json();
    if (!res.ok) return null;
    return data.conversation.id as string;
  } catch {
    return null;
  }
}
