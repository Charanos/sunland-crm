import type { UserRole } from "@/types";

/**
 * First argument every service function takes (backend master §2.1).
 * `entityId` is the caller's active entity scope for this request — resolved
 * server-side from the user's entitlements, never trusted from client input.
 * `null` means "no specific entity for this request" (e.g. a route whose
 * action doesn't naturally have one yet) — never a placeholder empty string,
 * which crashes uuid-typed columns; see resolve.ts's `ANY_SCOPE` handling.
 */
export type CallerContext = {
  user: { id: string; email: string; name: string; role: UserRole };
  entityId: string | null;
  requestId: string;
  actorIp?: string;
};
