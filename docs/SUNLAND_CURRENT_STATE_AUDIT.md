# Sunland ERP — Current-State Audit (Reality vs. Intent)

Date: 2026-06-29
Author: Senior systems review pass
Scope: Full frontend + backend audit of `sunland-crm`, with emphasis on the Finance module. This is a **diagnostic** document — it records what is actually in the codebase today, verified by reading the source, and measures it against the design intent captured in the existing specs (`SUNLAND_ERP_IMPLEMENTATION_SPEC.md`, `SUNLAND_FINANCE_DASHBOARD_SPEC.md`, the ADRs, and the Terrain Identity foundation).

It is deliberately blunt. The purpose is to give an accurate baseline so the backend build (a separate session) starts from truth, not from the impression the UI gives.

> **One-line summary:** the design intent is excellent and unusually detailed; the *frontend* is broad and visually production-grade; the *backend* is a thin slice — a single flat `transactions` table plus a handful of API routes that **synthesize** double-entry accounting, historical trends, and department state at read-time. The finance dashboard looks like a system of record. It is not one yet.

---

## 0. How to read this

- **"Intent"** = what the specs/ADRs say the system should be.
- **"Reality"** = what the code does today (file-level evidence cited).
- **"Gap"** = the delta, with a severity: `P0` (blocks trustworthy use), `P1` (robustness/correctness), `P2` (polish/hardening).
- Companion documents that turn these gaps into a build plan: `SUNLAND_BACKEND_ARCHITECTURE_MASTER.md`, `SUNLAND_FINANCE_LEDGER_ARCHITECTURE.md`, `SUNLAND_DASHBOARD_PORTAL_ARCHITECTURE.md`, `SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md`, `SUNLAND_PUBLIC_SITE_CMS_CRM_INTEGRATION.md`.

---

## 1. Stack & foundations (verified, healthy)

| Area | State | Notes |
|---|---|---|
| Framework | Next.js 16.2 (App Router, React 19) | Modern; uses the new `proxy.ts` edge convention (ADR 005.1), not legacy `middleware.ts`. |
| DB / ORM | Neon Postgres + Drizzle ORM 0.45 | Single schema file `src/db/schema/index.ts`. Driver is `@neondatabase/serverless`. |
| Auth | Custom JWT via `jose`, httpOnly cookie `sunland_session` | Stateless; 7-day expiry. `src/lib/auth/session.ts`. |
| Client state | Zustand (`src/store/*`), TanStack Query | Query layer thin so far (`src/lib/queries/dashboard.ts` is 29 lines). |
| Realtime | Ably adapter behind `src/lib/realtime/*` (spec names Pusher — ADR 006) | Isolated, not yet wired into department flows. |
| Cache | Upstash Redis (`src/lib/cache/upstash.ts`) | Used by `getExecutiveDashboard()` to cache the **mock** dashboard for 300s. |
| Design system | "Terrain Identity" — Sunland Yellow `#f3df27`, Brand Dark `#151936`, Warm Workspace `#f4f6f0`, Cormorant Garamond serif titles, JetBrains Mono for figures, font-weight capped at 500 | Well-documented and consistently applied in the finance UI. Strong. |

**Verdict:** foundations are sound and modern. Nothing here needs to be torn out. The gaps below are about *depth*, not *stack*.

---

## 2. The headline finding: Finance is a read-time simulation, not a ledger

The Finance module is where the most work has gone and where the incompleteness is most consequential, because Finance is explicitly designated "the core engine" (ADR 002, ERP spec §5) that every other module feeds.

### 2.1 What the database actually has

`src/db/schema/index.ts` defines **11 tables total**: `entities`, `users`, `contacts`, `properties`, `leads`, `leases`, `maintenance_requests`, `transactions`, `approval_requests`, `notifications`, `activity_logs`. (Confirmed live in `db-error.txt`.)

For all of Finance, there is exactly **one** money table:

```
transactions(id, entity_id, type[rent|commission|valuation_fee|expense|deposit|other],
             contact_id?, property_id?, lease_id?, amount_kes, occurred_at,
             recorded_by_id?, notes?, metadata)
```

This is a **flat, single-amount cash-movement log**. It has:
- no debit/credit,
- no account references,
- no journal-entry grouping,
- no concept of a chart of accounts.

### 2.2 What the UI implies exists

The finance route tree (`src/app/(app)/(fin)/fin/**`) ships **~50 routes** implying a full accounting suite:

- `ledger/` → `chart-of-accounts`, `journal-entries`, `trial-balance`, `balance-sheet`, `cash-flow`
- `rentals/` → `collections`, `defaulters`, `deficits`, `vacancies`
- `mandates/` → `active`, `draft`, `pending-approval`, `terminated`
- `payroll/` → `runs`, `payslips`, `remittances`
- `ap-ar/` → `payables`, `receivables`
- `cheques/` → `deposited`, `credited`, `returned`
- `fees/` → `rules`, `charges`
- `commissions/`, `balance-sheet/`, `cash-flow/`, `reports/` → `generate`, `library`, `verify/[token]`

None of these have backing tables. The double-entry model the ERP spec §5.1 mandates (`accounts` / `journal_entries` / `journal_lines`) **does not exist in the schema.**

### 2.3 How the gap is currently hidden

`src/app/api/finance/ledger/route.ts` **fabricates** the entire chart of accounts, journal entries, and account balances at request time from the flat `transactions` rows:

- The 7-account chart of accounts is a **hardcoded array inside the route handler** (codes 1000/1200/1300/2000/3000/4000/5000), not a table.
- Journal entries are **synthesized per transaction** using hardcoded posting rules embedded in an `if (tx.type === ...)` ladder. They are computed on read and **never persisted** — there is no immutable journal.
- Retained earnings is literally `3485000 + otherSum` — a **magic seed constant** baked into the handler.
- The 90/10 landlord/management-fee split is hardcoded in the handler (`amt * 0.90`, `amt * 0.10`).

`src/app/api/finance/reports/route.ts` computes the current month from the DB but **mocks the previous five months** ("Past months: mock realistic occupancy variations").

`src/app/api/finance/rentals/route.ts` hardcodes the 10% fee and computes arrears as `expected − collected` where `expected` is **one month's** lease rent but `collected` is the **all-time** sum of rent transactions for that lease — a correctness bug that will misreport arrears the moment there is more than one month of history.

`src/lib/queries/dashboard.ts` → `getExecutiveDashboard()` returns `executiveDashboardMock` (473-line mock file) wrapped in a Redis cache. The CEO dashboard is **100% mock**.

Most finance board components (`src/components/finance/*-board.tsx`) carry their demo data **inline as component constants** — only 4 of ~17 finance components issue a `fetch()` at all.

### 2.4 Why this matters (not just cosmetic)

An accounting system's entire value is that balances are **derived from an immutable, balanced journal** and are therefore trustworthy, auditable, and reconcilable. The current design has the opposite property: balances are **recomputed from assumptions on every read**, so:

- There is no audit trail of *how* a balance came to be (journal entries vanish after the response is sent).
- Two reads can disagree if the hardcoded rules change between deploys.
- The balance sheet cannot be trusted for a bank, auditor, or the CEO — which is precisely the audience the report-verification QR feature (spec §5.9) is built for.
- The trial balance cannot actually be proven to balance, because there are no stored debits/credits to sum.

This is the **single most important thing to fix**, and it is a backend problem, not a UI problem. The UI is largely ready to consume a real ledger. See `SUNLAND_FINANCE_LEDGER_ARCHITECTURE.md`.

**Gap F-1 (P0):** No persisted double-entry ledger. `accounts`, `journal_entries`, `journal_lines` tables absent; ledger synthesized at read-time with hardcoded rules and a magic retained-earnings constant.
**Gap F-2 (P0):** No `property_mandates` / `mandate_collections` / `mandate_expenses` tables — management-fee and landlord-remittance logic (spec §5.4) lives nowhere; the 90/10 split is a string literal in a route handler.
**Gap F-3 (P0):** No `rental_ledger` (per-unit-per-period). Arrears computed incorrectly (all-time collected vs one-month expected).
**Gap F-4 (P1):** No `bankers_cheques`, `service_fee_rules`/`charges`, `accounts_payable`/`receivable`, `payroll_runs`/`payslips`/`statutory_remittances`, `commissions`/`wht` tables. Every one of these has a built UI page and no data model.
**Gap F-5 (P1):** Reports mix real (current month) and mocked (prior months) data in the same series with no indication which is which.
**Gap F-6 (P1):** The single `transactions` table has no path to become the ledger — it must be superseded by the journal, with `transactions` either retired or demoted to a raw bank-feed staging table.

---

## 3. Backend architecture gaps (cross-cutting)

### 3.1 No service layer

There is no `src/lib/services/**`. API route handlers talk to Drizzle directly and embed business logic inline (the ledger route is the extreme case). There is no single balanced-posting write path, no shared authorization checkpoint, no domain-error taxonomy. Compare Andishi, which routes every mutation through `src/lib/services/<module>/*` with `authorize()` + `writeAudit()` in one place.

**Gap A-1 (P0):** No service/repository layer. Business rules (fee splits, approval thresholds, posting logic) are scattered across route handlers and will drift.

### 3.2 RBAC is route-prefix gating, not permission-based

`src/lib/auth/roles.ts` is a `Record<UserRole, string[]>` of allowed **path prefixes**, enforced only in `proxy.ts`. Consequences:

- Authorization gates **routes, not actions**. Any role that can load `/fin/ledger` can call every API the page calls; there is no `can(user, "finance.journal.post")` action-level check anywhere.
- The role list is a flat enum (24 values incl. "prototype aliases retained until auth/user seed data is migrated" — a known debt marker in the schema).
- No permission catalog, no role→permission mapping table, no scope model beyond `entity_id`.
- **Dev auth is bypassed by default**: `proxy.ts` returns `NextResponse.next()` whenever `NODE_ENV !== "production" && SUNLAND_AUTH_BYPASS !== "false"`. RBAC is effectively untested in normal dev.

**Gap A-2 (P0):** No action-level authorization. Route-prefix gating cannot express "Finance Officer may *record* a receipt but only Finance Head may *approve* a landlord remittance."
**Gap A-3 (P1):** Role enum carries prototype aliases; no permission/role tables; no server-side enforcement inside write paths (only edge route gating).

### 3.3 No server-side session store

Sessions are stateless JWTs. There is no `sessions` table, so there is no revocation, no "sign out all devices," no session listing — features the Executive/System-Admin spec (§8.3) and any security-conscious ERP will want. (Andishi added exactly this; it's a clean pattern to reuse.)

**Gap A-4 (P2):** No session persistence/revocation.

### 3.4 Approval engine: table exists, enforcement doesn't

`approval_requests` is well-modeled (generic, entity-scoped, escalation chain via `escalated_from`, `required_approver_role`, decision audit fields) and matches ADR 004. The API routes `finance/approvals/{create,decide}` exist. **But** the consequential-write threshold rules from the Finance Revamp guide (cheques > KES 500k hold; mandates > 10 units; petty cash > KES 5k) are **not enforced server-side** — they live in prose and, at best, client-side presentation. ADR 004 explicitly requires server-side checks.

**Gap A-5 (P1):** Approval thresholds not enforced in a write path; the generic engine isn't yet invoked by the events that should trigger it.

### 3.5 No audit trail with before/after deltas

`activity_logs` records `action` + `summary` + freeform `metadata`, but not structured before/after snapshots. The Finance Revamp guide §5 promises an "immutable audit trail" on every detail drawer. For a finance system of record, an actor/delta log (who changed what, from what, to what, when, with what request id) is table stakes.

**Gap A-6 (P1):** Audit log lacks structured before/after; not written from a central choke point (because there's no service layer — see A-1).

### 3.6 Migrations / relations

There is a `src/db/schema/migrations` folder but a single monolithic `schema/index.ts` and no `relations.ts` for typed relational queries. As the schema grows to the ~30 tables Finance alone needs, the single-file schema and hand-joined queries will get unwieldy.

**Gap A-7 (P2):** Schema will need to be split by module and given a `relations.ts`; migration discipline should be established before the finance tables land.

---

## 4. Dashboard independence & routing (the "profile routed to /admin/profile" problem)

This is a real, diagnosable architectural inconsistency, and the code is caught **mid-migration** between two competing models.

### 4.1 The two models in conflict

- **Model A (written in the specs & ADR 005/008):** departments are canonical **under `/admin`** — `/admin/finance`, `/admin/hr`, `/admin/business-development`, `/admin/front-office`. Self-service pages (Profile, Settings, Security, Messages, Notifications) are **hosted under `/admin`** and whitelisted in `UNIVERSAL_PATHS` (ADR 008). `/fin`, `/hr`, `/ops` are "temporary redirects that must not host new functionality."
- **Model B (what the code actually built):** Finance is a **fully independent route group** `src/app/(app)/(fin)/fin/**` with its own layout and its own `fin/profile`, `fin/settings`, `fin/security`, etc. The `COMPREHENSIVE_REVAMP_WALKTHROUGH.md` §10 ("Standalone Account Portals under Finance Route Scopes", "Dynamic Portal Prefix Navigation") documents this as an intentional pivot toward independent portals.

The migration is **half done**: Finance moved to Model B. HR, Business Development, and Front Office are **still Model A** — their functionality lives under `(ceo)/admin/*` (`/admin/hr`, `/admin/pipeline`, `/admin/front-office`), and `getDefaultPortal()` in `roles.ts` sends those roles into `/admin/*`.

### 4.2 Why the profile bug happens

`UNIVERSAL_PATHS` whitelists **both** `/admin/profile` and `/fin/profile`, and ADR 008 says self-service is "hosted under the `/admin` path group." So depending on which link a page renders, a Finance user can be bounced from the `/fin` shell into the `/admin` (CEO) shell to view their profile — exactly the symptom reported. HR/BD/Front-Office users have **no independent profile at all**; their profile *is* `/admin/profile`, sharing the CEO route group and layout.

### 4.3 What "independent but interconnected" requires

The user's stated goal — every dashboard independent in its own route scope, but the whole system coherent — means committing fully to **Model B for every role** and retiring Model A:

- Each portal is a self-contained route group with its **own** layout, sidebar, and its **own** `profile`/`settings`/`security`/`notifications`/`messages` (no cross-portal jump for self-service).
- A single portal-prefix helper resolves the current portal so shared components link within the active portal, never hardcode `/admin/*`.
- Interconnection happens through **shared data and the approval/notification engines**, not through shared routes.

This is specified in `SUNLAND_DASHBOARD_PORTAL_ARCHITECTURE.md`, which proposes superseding ADR 005 and ADR 008.

**Gap D-1 (P0):** Portal migration is half-finished; HR/BD/Front-Office lack independent route groups and self-service pages.
**Gap D-2 (P0):** Self-service (profile/settings/etc.) is not portal-local; navigation can jump users across shells. Root cause of the reported bug.
**Gap D-3 (P1):** `getDefaultPortal()` and `roleAccess` encode the `/admin/*` model and must be rebuilt around independent portals + a real permission model.

---

## 5. Roles present vs. roles needed

The `user_role` enum covers 16 real internal roles + 8 prototype aliases. **It has no `tenant` or `landlord` role**, and `contacts` (which hold `type: landlord|tenant`) have **no `users` linkage** — so landlords and tenants cannot authenticate. The user now wants tenant and landlord portals (payments, complaints, transfer notices, remittance statements). This is **net-new scope** with no existing spec.

**Gap E-1 (P1, new scope):** No external-user identity model. Tenants/landlords exist only as CRM contacts; there is no login, no contact→user provisioning, no external-portal RBAC. Specified in `SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md`.

---

## 6. Module-by-module scorecard

| Module | Frontend | Backend data model | Wiring | Severity of gap |
|---|---|---|---|---|
| **Finance — Ledger/COA/TB/BS/CF** | Rich, polished | **Absent** (synthesized) | Fake at read-time | **P0** |
| **Finance — Rentals** | Rich | Partial (`leases`, `transactions`) | Real but arrears bug | **P0** |
| **Finance — Mandates** | Built | **Absent** | Inline mock | **P0** |
| **Finance — Payroll** | Built | **Absent** | Inline mock | **P1** |
| **Finance — AP/AR** | Built | **Absent** | Inline mock | **P1** |
| **Finance — Cheques** | Built (QR proofs) | **Absent** | Inline mock | **P1** |
| **Finance — Fees / Commissions / WHT** | Built | **Absent** | Inline mock | **P1** |
| **Finance — Reports + QR verify** | Built | **Absent** (`report_exports`) | Partial/mock | **P1** |
| **Executive (CEO/GM)** | Rich | Reads only existing tables | **100% mock** (`executiveDashboardMock`) | **P1** |
| **CRM / Pipeline (BD)** | Built | Real (`leads`, `contacts`, `properties`) | Partial | **P2** |
| **Properties / Leases** | Built | Real | Partial | **P2** |
| **HR** | Stub (`(hr)/hr`) + `/admin/hr` | **Absent** (no employee/leave/payroll-source tables) | Mock | **P1** |
| **Front Office / Ops** | Stub (`(ops)/ops`) + `/admin/front-office` | **Absent** | Mock | **P2** |
| **Approvals engine** | Routes exist | `approval_requests` present & good | Not triggered by events | **P1** |
| **Notifications** | Present | `notifications` present & good | Partial | **P2** |
| **Tenant portal** | Does not exist | Does not exist | — | **P1 (new)** |
| **Landlord portal** | Does not exist | Does not exist | — | **P1 (new)** |
| **Public site (sunland.co.ke)** | Separate/legacy | Not integrated | — | **out-of-scope note** |

---

## 7. What is genuinely good (keep, build on)

Being blunt about gaps shouldn't obscure real strengths:

1. **The specs are exceptional.** ERP spec §5 already states the correct double-entry model, the rent-as-landlord-liability distinction, the generated-column management-fee rule, WHT/PAYE/NSSF/SHIF/AHL statutory handling, cheque-credit posting, and QR report verification. Most of the finance architecture doc is *operationalizing* intent that already exists, not inventing it.
2. **Entity scoping is designed in from the start** (`entity_id` on every domain table, `entitySlug` enum, `isConsolidated` flag, `scopeEntityFilter()` helper). Multi-entity consolidation to Sunland Group is achievable without a rewrite.
3. **The approval engine is generic and correct** (ADR 004) — it just needs to be invoked.
4. **The design system is disciplined and consistent** (Terrain Identity), which is why the UI reads as production-grade.
5. **The finance UI is a genuine asset** — the boards, drawers, modals, pagination, and QR proofs are largely ready to consume a real ledger with minimal rework.

The task ahead is not "rebuild Sunland." It is "make the backend as real as the frontend already pretends to be, finish the portal-independence migration, and add the two external portals + the public-site integration."

---

## 8. Prioritized gap register (summary)

**P0 — blocks trustworthy use, do first:**
- F-1 Persisted double-entry ledger (accounts/journal_entries/journal_lines).
- F-2 Property mandates + mandate collections/expenses (generated-column fees).
- F-3 Rental ledger (per-unit-per-period) + correct arrears/aging.
- A-1 Service layer with a single balanced-posting write path.
- A-2 Permission-based (action-level) RBAC.
- D-1 / D-2 Finish portal-independence migration; make self-service portal-local.

**P1 — robustness/correctness:**
- F-4 Cheques, fee rules/charges, AP/AR, payroll+statutory, commissions/WHT tables.
- F-5 Reports on real data end-to-end.
- A-3 Real role/permission tables; enforce in write paths.
- A-5 Approval thresholds enforced server-side and event-triggered.
- A-6 Structured before/after audit log from a central choke point.
- E-1 External identity model (tenant/landlord users).
- Executive dashboard off mock onto real aggregates.
- HR data model (employee/leave/time → payroll source).

**P2 — hardening/polish:**
- A-4 Session persistence/revocation.
- A-7 Split schema by module + `relations.ts` + migration discipline.
- CRM/Properties/Leases/Front-Office full wiring.
- Public-site CMS/CRM integration (out of primary scope; see its doc).

---

## 9. Recommended sequence (headline)

Finance-first, exactly as ADR 002 demands, because every other module feeds it:

1. **Foundation:** service layer + domain errors + permission model + entity-scope helper hardening + audit choke point. (Unblocks everything.)
2. **Ledger core:** COA + journal + balanced posting service + trial balance. Prove it balances before anything posts to it.
3. **Rentals + mandates:** rental ledger, mandate collections/expenses (generated fees), landlord remittances — the heart of a property-management P&L.
4. **AP/AR, cheques, fees, commissions/WHT, payroll+statutory.**
5. **Reports + QR verification** (now that real data exists to report on).
6. **Portal-independence completion + external portals (tenant/landlord).**
7. **Executive dashboard onto real aggregates; public-site integration.**

The detailed, migration-ready version of this lives in `SUNLAND_BACKEND_ARCHITECTURE_MASTER.md` §Roadmap and `SUNLAND_FINANCE_LEDGER_ARCHITECTURE.md`.
