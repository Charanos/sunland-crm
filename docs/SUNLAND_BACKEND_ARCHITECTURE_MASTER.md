# Sunland ERP — Backend Architecture Master

Date: 2026-06-29
Status: **Authoritative backend build plan.** This is the spine document; the finance ledger, dashboard/portal, and external-portal docs are deep-dives it links to. It does not override the client-facing product specs (`SUNLAND_ERP_IMPLEMENTATION_SPEC.md`); it turns their intent into a concrete, sequenced, migration-ready backend and reconciles the places where the code has diverged from the specs.

Reading order for a fresh implementation session:
1. `SUNLAND_CURRENT_STATE_AUDIT.md` — where we are and why.
2. **This doc** — principles, data-model map, RBAC, roadmap.
3. `SUNLAND_FINANCE_LEDGER_ARCHITECTURE.md` — the core engine.
4. `SUNLAND_DASHBOARD_PORTAL_ARCHITECTURE.md` — independent portals + RBAC enforcement surface.
5. `SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md` — external portals (new scope).
6. `SUNLAND_PUBLIC_SITE_CMS_CRM_INTEGRATION.md` — sunland.co.ke rework (out of primary scope).

---

## 1. Architecture principles (the non-negotiables)

1. **Finance is the core engine (ADR 002).** Built first, built deepest. No department maintains its own money balance; all balances derive from the general ledger. See finance doc.
2. **One write path per concern.** Every consequential mutation goes through a **service function** that (a) authorizes, (b) validates, (c) executes in a transaction, (d) writes an audit record. No business logic in route handlers. (Today's code violates this — logic lives in handlers.)
3. **Action-level authorization, not route gating.** `can(user, "finance.journal.post")` inside the service, in addition to edge route guards. Route gating alone cannot express who may *approve* vs merely *view*.
4. **Entity scope is mandatory (ADR 003).** Every domain row carries `entity_id`; Group consolidates. All reads pass through `scopeEntityFilter`.
5. **Approvals are shared infrastructure (ADR 004), enforced server-side.** The generic `approval_requests` engine is invoked by the services that trigger it; UI badges reflect server state.
6. **Append-only financial history.** Corrections are reversals, never edits/deletes. Audit is a first-class, structured (before/after) log written from the service choke point.
7. **Portals are independent, the system is one (supersedes ADR 005/008).** Each role's dashboard is a self-contained route group with its own shell and self-service pages; interconnection is via shared data + approvals + notifications, not shared routes. See portal doc.
8. **Realtime and cache stay behind adapters (ADR 006).** Department code depends on `src/lib/realtime/*` and `src/lib/cache/*`, never a vendor SDK directly.

---

## 2. Layered architecture (target)

```
Route handler (src/app/api/**)           thin: parse, call service, map errors → HTTP
  → Service (src/lib/services/<module>)  authorize + validate + transaction + audit
    → Repository / Drizzle (src/db)      typed queries; entity-scoped
      → Postgres (Neon)                  the journal is the source of financial truth
Cross-cutting: authz (permissions), audit, approvals, notifications, realtime, cache
```

New directories to create (currently absent — see audit A-1):
- `src/lib/services/**` — one folder per module (`finance/`, `identity/`, `crm/`, `properties/`, `hr/`, `approvals/`, `notifications/`).
- `src/lib/authz/` — permission catalog, `can()` / `authorize()`, domain-error classes.
- `src/lib/validation/**` — Zod schemas per module (client + server share them; the Finance Revamp guide §3 already mandates Zod `.refine()` balance checks).
- `src/db/schema/**` split by module + `src/db/relations.ts`.

### 2.1 Standard error envelope + service contract

Adopt Andishi's proven shape: `DomainError` subclasses (`ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409, `DomainValidationError` 400, `RateLimitedError` 429) mapped to HTTP by a single `handleRouteError()`. Services take a `CallerContext { user, entityId, requestId, actorIp }` first argument.

---

## 3. Identity, RBAC & sessions (redesign)

### 3.1 From enum-of-roles to permission catalog — **IMPLEMENTED (2026-07-08)**

Was: `user_role` enum (16 real + 7 prototype aliases — the master doc originally said 8; verified live, it's 7: `bd_head, agent, property_manager, accounts_manager, accounts_officer, hr_manager, auditor`) + a path-prefix map in `roles.ts`. Now: a real permission model, live in `src/lib/authz/catalog.ts` and seeded into Postgres.

```
permissions        key (e.g. "finance.journal.post"), module, resource, action, description
roles              id, slug, name, is_system, scope_type(global|entity|self)
role_permissions   role_id, permission_id
user_roles         user_id, role_id, entity_id?     (a user can hold a role scoped to an entity)
```

- Permission key convention: `<module>.<resource>.<action>` — **strictly 3 segments, no exceptions.** (`perm()` in `catalog.ts` splits on `.` assuming exactly 3 parts; a 2-segment key like `settings.read` silently produces `action: undefined`, which Postgres rejects at seed time as a NOT-NULL violation on `permissions.action` — hit and fixed during implementation. `settings.entity.read`/`audit.log.read` are the corrected forms.)
- **24 permissions seeded** across identity/settings/audit/crm/properties/finance — deliberately scoped to modules with a real data model *today*. HR/BD/Front/Ops get their own permission keys when their own phase builds their tables (per §7); inventing keys for tables that don't exist would just be code that lies.
- **Super admin (CEO) = holds every permission explicitly** (seeded as real `role_permissions` rows, not a code-level bypass) — verified live: 24/24. GM holds all except `identity.role.write` (CEO-only role/permission-catalog editing).
- **Department-head roles (`finance_head`, `hr_head`, `front_office_head`) are `scopeType: "global"`, not `"entity"`.** This was a real bug caught during implementation, not a design guess: the seed data assigns every department head `primaryEntityId = group` while officers (`finance_officer`, `line_manager`, `operations_lead`) get a specific operating entity — that pattern only makes sense if department heads oversee their function company-wide (global grant, `user_roles.entityId = null`), not if they're pinned to literally the Group entity's own rows. Caught by an end-to-end test: financeHead (scoped to `group` only) was wrongly denied deciding a Commercial-entity approval request. **Rule going forward: a department head who oversees a function across every entity gets `scopeType: "global"`; an officer doing day-to-day work in one entity gets `scopeType: "entity"` with that entity's id.**
- System roles (`isSystem: true` — all 16 real roles) are **immutable via the API**: `seedPermissionCatalog()` fully replaces every system role's `role_permissions` on every seed run, so an API-side edit would silently vanish on the next deploy. Only custom, non-system roles created via `POST /api/identity/roles` can be edited/deleted through the API.
- Kept the existing `user_role` enum as a coarse label (drives `getDefaultPortal()`/route-prefix routing only); real access comes from `role_permissions`. **Known drift, not yet fixed**: the frontend-facing `UserRole` type (`src/types/index.ts`) includes `"rentals_officer"`, which does **not** exist in the DB's `user_role` pgEnum — surfaced while removing an `as any` cast in `api/auth/emulate/route.ts`. Left alone deliberately since `src/types/index.ts` is a shared type likely also consumed by concurrent frontend work; reconcile in a dedicated pass, not as a drive-by fix.
- Retiring the 7 prototype aliases is still future cleanup, not done — they hold zero permissions today (simply never granted), so they're inert rather than actively wrong.

### 3.2 Sessions — **IMPLEMENTED (2026-07-08)**

`sessions` table live (id, user_id, token_hash, expires_at, ip, user_agent, revoked_at). Real implementation in `src/lib/auth/session.ts`:
- `setSession()` generates a `jti` (= the session row's own uuid), stores `sha256(jti)` as `token_hash` (never the raw value), embeds the `jti` in the signed JWT via `setJti()`, and records `ip`/`user_agent` from the request.
- `getCurrentUser()` verifies the JWT as before, **then** looks up the session by hashed jti and rejects (returns `null`) if the row is missing, `revoked_at` is set, or `expires_at` has passed. This is a real DB round-trip on every authenticated request — a deliberate tradeoff, since revocation is meaningless without checking it.
- `clearSession()` (real sign-out) now revokes the session row, not just deleting the cookie.
- Management surface: `GET /api/identity/sessions` (own sessions need no permission; another user's needs `identity.session.read`), `POST /api/identity/sessions/[id]/revoke` (own device always revocable; someone else's needs `identity.session.revoke` — the "sign out a compromised account" action System Administration needs).
- **Known limitation, not built**: `src/proxy.ts` (edge route guard) still does JWT-signature-only checking, no revocation check — edge/Node runtime constraints (the `neon-serverless` `Pool`+`ws` transport is Node-only, not Edge-compatible) mean the *coarse* portal-access gate can't yet check revocation. The *fine* gate — every actual data-touching service call via `getCurrentUser()` — does. A revoked session can theoretically still load a page shell for a moment but cannot successfully call any authorized service. Documented here rather than silently accepted; revisit if the coarse gate ever needs to be airtight (e.g. a genuinely urgent "kill this session right now, no exceptions" requirement).

### 3.3 The role → portal map (see portal doc for the full model)

Internal roles resolve to independent portals: CEO/GM → `/exec` (or keep `/admin` but as its own group), Finance family → `/fin`, HR → `/hr`, BD/Line-Manager → `/bd`, Front-Office → `/front`, Ops → `/ops`. External: Landlord → `/landlord`, Tenant → `/tenant`. Each is a self-contained route group.

> **Updated 2026-07-08:** "BD/Line-Manager" above is stale terminology. The client finalized the org structure — see **ADR 013** (`docs/ARCHITECTURE_DECISIONS.md`) for the full roster. Everything this section calls "BD" now sits under **Head of Strategy** (new department-head role, oversees Property Managers, Line Managers, Sales, Marketers), and "Line Manager" itself no longer exists as a role (folded into `property_manager` earlier this build). Finance also gains client-facing titles — Senior Accountant (`finance_officer`, relabeled) and Internal Auditor (`auditor_compliance`, relabeled, plus a new 90-day delayed finance-access rule) — and a new Admin (CEO's Assistant) role is proposed pending client confirmation.
> **Updated 2026-07-10 (ADR 014):** `head_of_strategy` is now a real catalog role (enum + `catalog.ts` permissions) — implementing it became load-bearing for correct mandate-activation approval routing (a Property Manager or Head of Strategy always needs GM sign-off; a GM/CEO acting within their own authority self-approves). `admin_assistant`, the Internal Auditor 90-day gate, and the Property Manager unified complaint/arrears/misc-charges view remain design-only — see ADR 014 for what's built vs. deferred.

### 3.4 System Administration surface — **IMPLEMENTED (2026-07-08)**

The CEO-oversight capabilities the portal doc §6 describes ("real dominion over role/permission escalation") are now real API surface, not just a data model:

| Concern | Service | Routes |
|---|---|---|
| Users | `src/lib/services/identity/users.ts` | `GET/POST /api/identity/users`, `GET /api/identity/users/[id]`, `PATCH .../profile` (self), `PATCH .../access` (staff) |
| Roles/permissions | `src/lib/services/identity/roles.ts` | `GET/POST /api/identity/roles`, `DELETE /api/identity/roles/[id]`, `GET/PATCH /api/identity/roles/[id]/permissions`, `GET /api/identity/permissions` |
| Role grants | `src/lib/services/identity/user-roles.ts` | `POST /api/identity/users/[id]/roles`, `DELETE /api/identity/user-roles/[id]` |
| Sessions | `src/lib/services/identity/sessions.ts` | `GET /api/identity/sessions`, `POST /api/identity/sessions/[id]/revoke` |
| Settings/thresholds | `src/lib/services/settings.ts` | `GET/POST /api/settings` |
| Audit explorer | `src/lib/services/audit-log.ts` | `GET /api/audit` |

Design details worth preserving as precedent:
- **`isLastSuperAdmin()`** (`src/lib/services/identity/access.ts`) — true iff exactly one active user holds the `ceo` role and it's the target user. Blocks two things: deactivating that user's account (`updateUserAccess`) and revoking their `ceo` role grant (`revokeUserRole`). This is the guard that keeps CEO dominion from being accidentally locked out — checked before both actions, not layered on after.
- **`updateUserProfile` (self, name/title) vs `updateUserAccess` (staff, role/isActive/primaryEntityId)** stay split — changing your own display name is not a permission-gated action; changing anyone's role or deactivating them is.
- **Role deletion is blocked, not cascaded**, if any `user_roles` still reference it — `user_roles.role_id` has `onDelete: cascade` at the DB level, which would otherwise silently strip the role from every holder the moment someone deletes it.
- **No email service exists** (checked before building — none configured). `createUser` returns a one-time plaintext temporary password in the response for the admin to relay out-of-band, rather than building a speculative invite/reset-token flow nothing else in the system needs yet.
- **Settings/thresholds are finally populated, not just modeled**: `cheque_hold_threshold_kes=500000`, `petty_cash_approval_threshold_kes=5000`, `mandate_unit_approval_threshold=10`, `mandate_default_rate=0.10`, seeded under the Group entity (`src/lib/services/settings.ts`'s `DEFAULT_SETTINGS` + `seedDefaultSettings()`). This was flagged as a gap in the original P0 pass and left unfinished until now.
- Verified live end-to-end: CEO holds 24/24 permissions; a finance_officer is correctly forbidden from `finance.approval.decide`; finance_head (global scope) can decide a Commercial-entity approval after the scoping fix; two audit rows land per approval lifecycle with populated before/after.

---

## 4. Entity model & consolidation (keep, formalize)

Four entities exist (`group`, `commercial`, `residential`, `valuers`) with `isConsolidated`. Formalize:
- Every module table: `entity_id NOT NULL` (except global config: permissions, fee-rule templates).
- Reads: `scopeEntityFilter(column, entityId | "group")`. When `group`, either the row's entity is the consolidated one, or the query unions child entities (finance consolidation eliminates inter-entity clearing — see finance §8).
- The entity switcher in the shell sets the active scope; services must never trust a client-supplied `entity_id` without checking the caller's entitlement to it.

---

## 5. Module & data-model map

Legend: ✅ exists · ⚠️ partial · ❌ absent (must build). Full finance column lists live in the finance doc; this is the map.

### 5.1 Platform / cross-cutting
| Table | State | Notes |
|---|---|---|
| entities | ✅ | keep |
| users | ✅ | add `contact_id?` link for external users; add avatar, phone |
| permissions / roles / role_permissions / user_roles | ✅ | §3.1 — 24 permissions, 16 system roles, seeded |
| sessions | ✅ | §3.2 — real revocation, not just the table |
| approval_requests | ✅ | now invoked from `finance/approvals.ts` service (P0 reference implementation) |
| notifications | ✅ | good; wire event emitters |
| activity_logs → audit_log | ✅ | `before_data`/`after_data`/`request_id` added; `writeAudit()` is the single choke point; `GET /api/audit` explorer live |
| accounting_periods | ❌ | finance §6.4 |
| settings (per-entity config, thresholds, fee defaults) | ✅ | §3.4 — 4 real thresholds seeded under Group; `GET/POST /api/settings` |

### 5.2 Finance (the engine — see finance doc for detail)
| Table | State |
|---|---|
| accounts (COA) | ❌ |
| journal_entries / journal_lines | ❌ (currently synthesized) |
| property_mandates / mandate_collections / mandate_expenses | ❌ |
| rental_ledger | ❌ (partially faked from leases+transactions) |
| bankers_cheques | ❌ |
| service_fee_rules / service_fee_charges | ❌ |
| accounts_payable / accounts_receivable | ❌ |
| payroll_runs / payslips / statutory_remittances | ❌ |
| commissions / wht_records | ❌ |
| report_exports | ❌ |
| transactions | ✅ → demote to raw receipt/bank-feed staging, or retire |

### 5.3 Property / CRM / Operations
| Table | State | Notes |
|---|---|---|
| properties | ✅ | align `property_type` to Sunland.co.ke designations (Apartment/Commercial/House/Land/Villa) |
| contacts | ✅ | landlord/tenant/buyer/seller/contractor; source of external users |
| leads | ✅ | pipeline; feeds BD portal + public-site inquiry capture |
| leases | ✅ | add renewal/termination/transfer-notice states for tenant portal |
| maintenance_requests | ✅ | shared by tenant portal (complaints) + Front Office/Ops |
| units | ⚠️/❌ | leases/rental-ledger reference "unit"; if a property has multiple units, add a `units` table (property_id, unit_code) |
| transfer_notices | ❌ | tenant move-out / transfer workflow (new, for tenant portal) |

### 5.4 HR (mostly absent — feeds payroll)
| Table | State |
|---|---|
| employees (extends users), leave_requests, time_logs, complaints, credentials/dependents/insurance | ❌ |
HR time logs are the **source** for payroll (spec §5.5/§6.5); build enough HR to feed Finance, defer the rest.

---

## 6. Cross-department workflows (spec §4 — implement as service orchestrations)

Each is a service that spans modules and uses the approval + notification engines:
- **Payroll → Finance remittance:** HR time logs → payroll run → journal (recipe finance §5.7) → statutory remittances.
- **Mandate letter flow:** BD/Line-Manager drafts mandate → >10 units triggers approval → active unlocks rental-ledger tracking.
- **Property mandate expense reimbursement:** Line-Manager logs expense → >5k triggers GM approval → nets against landlord remittance (finance §5.2/§5.3).
- **Banker's cheque verification:** capture (deposited) → >500k approval → credited posts journal (finance §5.5) → QR proof.
- **Company vehicle request / promotion-demotion:** generic approval flows.
- **Rent default follow-up:** rental_ledger defaulter → notification to Line-Manager who owns the relationship.

---

## 7. Phased delivery roadmap

Finance-first per ADR 002. Each phase: schema → migration → services (+authz+audit) → API → validation → tests → replace mock → docs update.

| Phase | Deliverable | Exit criteria |
|---|---|---|
| **P0 Foundation** — ✅ **DONE (2026-07-08)**, incl. full System Administration surface (§3.4) | service layer, `authz` (permissions/roles tables + `can`/`authorize`), domain errors, error envelope, audit choke point, `sessions` (real revocation), split schema + relations, `settings` (thresholds as data, seeded), seed permission catalog + CEO super-admin, user/role/session management API | `typecheck`+`lint` clean (verified; `build` deferred — not run per explicit instruction while frontend work is concurrent); a permission denies where it should (verified live); audit rows written on a sample write (verified live, 2 rows/lifecycle) |
| **P1 Ledger core** | COA + journal + `postJournalEntry` + `assertBalanced` + accounting periods; backfill from `transactions`; cut ledger API over; trial balance | trial balance provably balances per entity on real data; no hardcoded financial constants remain |
| **P2 Rentals + mandates** | rental_ledger (correct arrears/aging), property_mandates + generated-column collections/expenses, landlord remittances, defaulters view | management fee = collected×rate (generated); landlord payable reconciles; arrears bucketed correctly |
| **P3 AP/AR + cheques + fees + commissions/WHT** | remaining subledgers + posting recipes + approval thresholds enforced server-side | cheque >500k cannot credit pre-approval; WHT tracked; AP/AR aged |
| **P4 Payroll + statutory** | payroll_runs/payslips/statutory_remittances sourced from HR time logs | PAYE/NSSF/SHIF/AHL computed; remittances post to journal |
| **P5 Reports + QR verification** | balance sheet, cash flow, landlord/mandate statements, report_exports + signed QR (spec §5.9) | reports run on real data; QR verifies a frozen snapshot |
| **P6 Portal independence** | finish Model B for all internal roles; portal-local self-service; permission-driven nav | no cross-portal jump for profile/settings; the reported routing bug is gone |
| **P7 External portals** | tenant + landlord identity + portals (payments, complaints, transfer notices, remittance statements) | a landlord sees a statement derived from `journal_lines`; a tenant pays and it posts |
| **P8 Executive on real data + public-site integration** | CEO/GM dashboard off `executiveDashboardMock` onto real aggregates; sunland.co.ke listings/inquiries wired to ERP | exec KPIs derive from ledger/rental/pipeline; a public inquiry lands as a CRM lead |

---

## 8. Definition of done (per phase, applied throughout)

- `npm run typecheck` and `npm run lint` clean; `npm run build` succeeds.
- Every new mutation: authorized (action-level), validated (Zod), transactional, audited.
- No business constant hardcoded in a route handler (thresholds/fees/splits live in `settings` or generated columns).
- Entity scope enforced on every read; caller entitlement to the entity checked.
- Mock data path replaced (or explicitly flagged as demo) for the module shipped.
- Docs updated: this master's map + the relevant deep-dive.

---

## 9. Cross-pollination footnotes — what Sunland teaches Andishi (and vice-versa)

Recorded here (in the Sunland repo, per instruction) so the Andishi session can pick them up. **No Andishi code is changed by this document.**

**Sunland → Andishi (worth replicating):**
1. **True double-entry ledger as the finance system of record.** Andishi's finance (P2) uses a balanced-posting ledger already — good — but Sunland's landlord-liability distinction (money-held-for-others ≠ revenue) is a sharper articulation of "clearing/trust liabilities." If Andishi ever holds client funds (e.g., escrowed milestone payments), the trust-liability pattern applies.
2. **Generated-column business rules.** Enforcing "fee = collected × rate" at the DB level (not app code) is a robustness pattern Andishi should adopt for any invariant a future dev might "helpfully" break (e.g., margin = bill − pay).
3. **Accounting periods + close.** Andishi has no period-close concept; Sunland's `accounting_periods` (reject posts into closed periods) is a good guardrail to port to Andishi finance.
4. **Report export + QR verification** (signed, time-limited, frozen snapshot) is a clean, low-infra authenticity feature Andishi invoices/reports could reuse.
5. **Approval thresholds as data in `settings`**, not constants — both systems benefit.

**Andishi → Sunland (already reflected in these docs):**
1. Permission-based RBAC (`module.resource.action` + `can()`/`authorize()`) — Sunland's biggest identity gap; lift Andishi's `authz` wholesale.
2. Service-layer choke point with `writeAudit()` before/after — Sunland has none.
3. Sessions table + revocation.
4. Independent route groups with self-contained self-service pages (Andishi's Platform-group work directly informs Sunland's portal-independence fix).
5. `OperationalDataTable` / `ModalShell` / `ConfirmDialog` shared-primitive discipline and the "audit shared components before patching a page" lesson.

These are notes, not commitments; each should be evaluated on its own merits in the respective repo.
