import { eq } from "drizzle-orm";
import { db } from "@/db";
import { entities } from "@/db/schema";

const BASE = "http://localhost:3001";

function extractCookie(res: Response): string {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("No Set-Cookie header in response");
  return setCookie.split(";")[0];
}

async function emulate(role: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/emulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error(`emulate(${role}) failed: ${res.status} ${await res.text()}`);
  return extractCookie(res);
}

async function call(method: string, path: string, cookie: string | null, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

let passCount = 0;
let failCount = 0;
function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passCount++;
    console.log(`PASS: ${label}`);
  } else {
    failCount++;
    console.log(`FAIL: ${label}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}

async function main() {
  const [groupEntity] = await db.select().from(entities).where(eq(entities.slug, "group")).limit(1);
  const [commEntity] = await db.select().from(entities).where(eq(entities.slug, "commercial")).limit(1);

  // --- Auth ---
  const ceoCookie = await emulate("ceo");
  const me = await call("GET", "/api/auth/me", ceoCookie);
  check("GET /api/auth/me returns ceo after emulate login", me.json?.user?.role === "ceo", me.json);

  const unauth = await call("GET", "/api/identity/users", null);
  check("GET /api/identity/users with no cookie -> 401", unauth.status === 401, unauth);

  // --- Identity: users/roles/permissions ---
  const usersList = await call("GET", `/api/identity/users?entityId=${groupEntity.id}`, ceoCookie);
  check(
    "GET /api/identity/users (group) returns the 5 group-scoped seeded users",
    usersList.status === 200 && Array.isArray(usersList.json?.users) && usersList.json.users.length === 5,
    usersList,
  );

  const rolesList = await call("GET", "/api/identity/roles", ceoCookie);
  check(
    "GET /api/identity/roles returns 16 system roles",
    rolesList.status === 200 && rolesList.json?.roles?.length === 16,
    rolesList.json?.roles?.length,
  );

  const permsList = await call("GET", "/api/identity/permissions", ceoCookie);
  check(
    "GET /api/identity/permissions returns 24 permissions",
    permsList.status === 200 && permsList.json?.permissions?.length === 24,
    permsList.json?.permissions?.length,
  );

  // --- Settings ---
  const settingsRes = await call("GET", `/api/settings?entityId=${groupEntity.id}`, ceoCookie);
  check(
    "GET /api/settings (group) returns 4 seeded thresholds",
    settingsRes.status === 200 && settingsRes.json?.settings?.length === 4,
    settingsRes.json,
  );

  // --- Audit ---
  const auditRes = await call("GET", `/api/audit?entityId=${groupEntity.id}&limit=5`, ceoCookie);
  check("GET /api/audit (group) returns entries", auditRes.status === 200 && Array.isArray(auditRes.json?.entries), auditRes.json);

  // --- Sessions ---
  const sessionsRes = await call("GET", "/api/identity/sessions", ceoCookie);
  check(
    "GET /api/identity/sessions (own) returns at least the current session",
    sessionsRes.status === 200 && sessionsRes.json?.sessions?.length >= 1,
    sessionsRes.json,
  );

  // --- Finance approvals: full deny/allow chain through real HTTP ---
  const officerCookie = await emulate("finance_officer");
  const created = await call("POST", "/api/finance/approvals/create", officerCookie, {
    entityId: "commercial",
    requestType: "petty_cash",
    relatedTable: "transactions",
    relatedId: crypto.randomUUID(),
    amountKes: 3000,
    requiredApproverRole: "department_head",
  });
  check("POST create approval as finance_officer succeeds", created.status === 200 && created.json?.success, created.json);
  const requestId = created.json?.request?.id;

  const deniedDecide = await call("POST", "/api/finance/approvals/decide", officerCookie, {
    requestId,
    status: "approved",
  });
  check("POST decide as finance_officer -> 403 (officer records, doesn't approve)", deniedDecide.status === 403, deniedDecide.json);

  const headCookie = await emulate("finance_head");
  const decided = await call("POST", "/api/finance/approvals/decide", headCookie, {
    requestId,
    status: "approved",
    decisionNotes: "HTTP e2e verification",
  });
  check("POST decide as finance_head succeeds", decided.status === 200 && decided.json?.request?.status === "approved", decided.json);

  const auditForRequest = await call(
    "GET",
    `/api/audit?entityId=${commEntity.id}&associatedType=approval_request&limit=10`,
    ceoCookie,
  );
  const matching = (auditForRequest.json?.entries ?? []).filter((e: { associatedId: string }) => e.associatedId === requestId);
  check("Audit log has 2 entries for this approval request (create + decide)", matching.length === 2, matching);

  // --- isLastSuperAdmin guard through real HTTP ---
  const ceoMe = await call("GET", "/api/auth/me", ceoCookie);
  const ceoId = ceoMe.json?.user?.id;
  const deactivateAttempt = await call("PATCH", `/api/identity/users/${ceoId}/access`, ceoCookie, { isActive: false });
  check(
    "PATCH deactivate the last active CEO via HTTP -> blocked (409)",
    deactivateAttempt.status === 409,
    deactivateAttempt.json,
  );

  // --- Real session revocation through logout ---
  const logoutRes = await call("POST", "/api/auth/logout", ceoCookie);
  check("POST /api/auth/logout succeeds", logoutRes.status === 200, logoutRes.json);
  const meAfterLogout = await call("GET", "/api/auth/me", ceoCookie);
  check("GET /api/auth/me with the now-revoked cookie -> user is null", meAfterLogout.json?.user === null, meAfterLogout.json);

  console.log(`\n${passCount} passed, ${failCount} failed.`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("SCRIPT ERROR:", err);
  process.exit(1);
});
