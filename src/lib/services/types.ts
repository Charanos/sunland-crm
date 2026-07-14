import { randomUUID } from "crypto";
import type { CallerContext } from "@/lib/authz/context";
import { UnauthorizedError } from "@/lib/authz/errors";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";

export type { CallerContext };

/** Builds the CallerContext every service function takes as its first argument. */
export function buildCallerContext(
  user: SessionUser,
  entityId: string | null,
  request?: Request,
): CallerContext {
  return {
    user,
    entityId,
    requestId: randomUUID(),
    actorIp: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  };
}

/**
 * Route-handler convenience: throws UnauthorizedError (→ 401 via
 * handleRouteError) instead of every route repeating the null-check.
 * `entityId` defaults to `null` ("no specific entity yet") for calls that
 * resolve/override the real scope from the request body or target resource
 * (see approvals service for why) - never a placeholder empty string, which
 * crashes uuid-typed columns the moment a service trusts it unresolved.
 */
export async function requireCallerContext(
  entityId: string | null = null,
  request?: Request,
): Promise<CallerContext> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return buildCallerContext(user, entityId, request);
}
