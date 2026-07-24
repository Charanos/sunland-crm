import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { computeOrgSecurityScore, getOrgPolicies, updateOrgPolicies } from "@/lib/services/account-console";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;
    const ctx = await requireCallerContext(entityId, request);
    const policies = await getOrgPolicies(ctx);
    return NextResponse.json({ policies, score: computeOrgSecurityScore(policies) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const entityId = body.entityId ?? null;
    const ctx = await requireCallerContext(entityId, request);
    const policies = await updateOrgPolicies(ctx, body.policies ?? body);
    return NextResponse.json({ success: true, policies, score: computeOrgSecurityScore(policies) });
  } catch (error) {
    return handleRouteError(error);
  }
}
