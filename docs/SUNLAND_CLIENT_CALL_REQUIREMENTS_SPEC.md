# Client Call Requirements — Revenue, Payroll, Reporting, Collections, Payments

**Source:** phone call between Dennis and the client, relayed 2026-07-17 as a forwarded note. Verbatim:

> Hello Dennis,
> Here are the areas we spoke on phone about:
> - On revenue streams; add agreement fees and sales as part of it.
> - on Payroll: add Britam tier2 remittance and also add the section for individual payslips.
> - On reporting; remove the property mandate part there and replace it with the P/L(profit and loss) document.
> - on collections; include landlords' accounts on the details section.
> - On revenue; have a drop down of the revenue streams, with the details available for each on clicking.
> - Add paybills for payment integration, especially for tenants.

**Status as of 2026-07-17: Phase H shipped.** This note arrived mid-session alongside an unrelated KPI/P&L redesign request and was initially deferred without surfacing that decision back to the client/Dennis — this document first corrected that gap, then (per Dennis's "quick wins first" + "scaffold now, wire later" direction) items 1, 3, and 5 were fully implemented against real data, item 6 was scaffolded (blocked on external credentials), and items 2 and 4 remain explicitly deferred as their own follow-up efforts. Per-item status is recorded below each entry.

**What shipped this pass:**
- Item 1 (revenue streams) — **done**. `agreement_fee`/`sales_commission` are real enum values, counted in `computeIncome()`, with real seeded transactions tied to the two real closed-deal leads.
- Item 3 (reporting) — **done**. "Property Mandates Summary" removed; "Profit & Loss Statement" generates a real, database-persisted snapshot via `generatePnLReport()` (`src/lib/services/finance/reports.ts`), reusing the exact same income/expense logic as the CEO dashboard's P&L card so the two can never silently diverge.
- Item 5 (revenue dropdown) — **done**. Finance Overview's "Revenue Breakdown" panel and "Revenue Streams" pie chart both now read real per-stream totals from `getRevenueStreamBreakdown()`, with click-to-expand transaction-level detail.
- Item 6 (paybill) — **scaffolded, not live**. Real `tenant_payments` table, STK-push initiation path, and Safaricom callback handler exist and are E2E-verified against a simulated Daraja payload — but `initiateTenantPayment()` deliberately refuses to run until real `MPESA_*` credentials are supplied (see `.env.example`). No live transaction can occur yet.
- Items 2 (payroll) and 4 (collections landlord accounts) — **not started**, per their own sections below.

**Frontend consistency audit (2026-07-17, requested follow-up):** traced every consumer of income/revenue figures across CEO-facing surfaces to confirm the new revenue types and P&L logic are actually wired through, not just built as isolated backend functions.
- **CEO Dashboard (`/admin`)** — fully consistent. Every figure (`incomeKes`, `profitKes`, revenue attainment, collection rate, mandate portfolio) flows through the single `getDashboardOverview()` call, which uses the same `computeIncome()`/`computeExpenses()` this pass updated - no separate/duplicate calculation exists on this page, so nothing extra needed fixing here.
- **Reports Center (`/admin/reports`, CEO-facing)** — its "Generate Report (Finance)" button correctly routes to `/fin/reports/generate`, the real P&L generator; CEO has both the route access (`/fin` prefix) and the `finance.transaction.write` permission (CEO holds every permission) needed to use it.
- **Finance Overview (`/fin`)** — the new Revenue Breakdown dropdown and Revenue Streams pie chart are real and correct. But its top-level "Revenue (MTD)" KPI banner was still the pre-existing hardcoded mock (`INITIAL_FINANCE_METRICS.revenueMtd`, ~KES 14.25M for group) sitting directly above the real breakdown (~KES 1.5-1.8M at this seed's scale) - a visible, glaring contradiction on the same page. **Fixed**: the banner now fetches real this-month vs last-month totals from `/api/finance/revenue-streams` on mount and computes a real trend %. Net effect for the "Commercial" tab specifically: it now shows KES 0 revenue (previously a fake ~KES 8.4M), because - per the same finding already documented in the executive dashboard KPI work - all real transaction/property data lives under the single "group" entity; commercial/residential/valuers entities have no real transactions of their own yet. This is a correct, honest reflection of current data, not a new bug.
- **Still mock on the same Finance Overview page, NOT fixed this pass** (a materially larger, separate gap, same class as items 2/4): Net Cash Position, A/R Outstanding, A/P Outstanding, Collection Rate banner, the Pending Approvals queue, the Alerts list, and the HR/BD/Front-Office cross-department sync numbers - all still `useState`-seeded from hardcoded mock objects (`INITIAL_FINANCE_METRICS`'s other fields, `INITIAL_PENDING_APPROVALS`, `INITIAL_FINANCE_ALERTS`, the `deptSync` state) with no backing schema/query at all. Flagged here rather than silently left, but out of scope for the revenue-streams work this pass was about.

---

## 1. Revenue streams: add agreement fees and sales — ✅ DONE (2026-07-17)

**Shipped:** `agreement_fee` and `sales_commission` added to the `transactionType` enum (migration `0020_crazy_diamondback.sql`), counted at 100% of amount in `computeIncome()` (`src/lib/services/dashboard.ts`), and wired into the `/fin/ledger` journal generator against real chart-of-accounts codes (4100 Letting/Lease Fee Revenue, 4200 Sales Commission Revenue — `src/app/api/finance/ledger/route.ts`). Real seed transactions tied to the two real `closed_won` pipeline leads: a KES 350,000 agreement fee (Nexus Tech Office Lease, one month's rent on the real property) and a KES 255,000 sales commission (3% of the Riverside Apartment Sale's real expected value). E2E-verified: both flow correctly into `incomeKes`/`incomeTrend` and the new revenue-stream breakdown (item 5).

**Original scoping notes (superseded by the above):** `transactions.type` (`src/db/schema/finance.ts:16-23`) is a Postgres enum: `rent | commission | valuation_fee | expense | deposit | other`. No `agreement_fee` or `sales`/`sales_commission` value exists. `computeIncome()` (`src/lib/services/dashboard.ts:62-69`) counts `commission` and `valuation_fee` at 100% of amount, and `rent` at the 10% management-fee rate — it has no branch for anything sale- or agreement-related. `commission` is validated but **never actually seeded** (`src/db/seed.ts` has zero `"commission"` rows today), so even the closest existing category has no real data behind it yet. The finance ledger architecture doc already names a future `4200 Sales Commission Revenue` ledger account (`docs/SUNLAND_FINANCE_LEDGER_ARCHITECTURE.md:79`) as aspirational, unbuilt.

**Proposed implementation:**
- Add two new `transactionType` enum values via migration: `agreement_fee` and `sales_commission` (naming TBD with client — "sales" likely means property-sale commissions, distinct from letting/management commission).
- Extend `computeIncome()` to count both at 100% of amount (same treatment as `commission`/`valuation_fee`).
- Add realistic seed transactions of both types so the figures aren't zero on first load.
- Feeds directly into Item 5 (revenue-stream dropdown) — these need to exist as real categories before they can be broken out visually.

**Size:** Small–Medium. One additive migration, one service function edit, seed data, no new tables.

---

## 2. Payroll: Britam Tier II remittance + individual payslips — NOT STARTED

Per Dennis's "quick wins first" sequencing decision (2026-07-17), this remains its own dedicated follow-up effort, not attempted in Phase H. Scoping below is unchanged.

**Current state:** This is the largest gap of the six. `payroll_officer` is a real RBAC role (`src/db/schema/platform.ts:23`) but scoped to only `finance.transaction.read` (`src/lib/authz/catalog.ts:186-190`) — it can't even write a transaction today. `/fin/payroll` renders `PayrollBoard` (`src/components/finance/payroll-board.tsx`, ~1,830 lines), which is a **fully designed UI with real Kenyan statutory math already written** — progressive PAYE bands, 6% NSSF (capped at KES 36,000 pensionable), 2.75% SHIF, Affordable Housing Levy (`calculateKenyanStatutories()`, ~line 339) — but every payroll run, payslip, and time log is a hardcoded `useState` mock array (`INITIAL_RUNS`, `INITIAL_PAYSLIPS`, `MOCK_TIME_LOGS`). Nothing persists to a database. There is no `employees` table anywhere in the schema (`dashboard.ts:277-278` already notes this gap explicitly), and no `payroll_runs`, `payslips`, or `statutory_remittances` tables exist in any of the 20 migrations. NSSF Tier II — the portion of the mandatory pension contribution that can be redirected to a licensed contracted-out scheme (e.g. Britam) instead of the default NSSF fund — isn't modeled at all today; there's no field distinguishing "Tier II stays with NSSF" vs "Tier II goes to a contracted-out provider."

**Proposed implementation** (real module, not a UI tweak):
- New tables: `employees` (or HR-specific columns joined to `users`), `payroll_runs`, `payslips`, and a way to record Tier II destination + remittance status (either a `statutory_remittances` table or fields on `payslips`).
- Wire the existing statutory-calculation logic in `payroll-board.tsx` to real persistence instead of local state.
- Individual payslip generation/view per employee (the UI shell for this already exists in the `payslips` tab — needs a real backing record and PDF/print view).
- Britam Tier II remittance: needs a client decision on the actual contribution rate/formula split and whether Sunland tracks-and-reports the remittance or actually initiates a transfer to Britam (the latter would be a second payment-integration effort, similar in kind to Item 6).

**Size:** Large. This is a genuinely new module (new employee data model, new payroll-run lifecycle, new payslip records) built on top of an already-solid UI skeleton. Recommend scoping and building this as its own dedicated effort rather than folding it into the same pass as the other five items — the design decisions alone (Tier II rate, payslip fields/template, approval workflow) warrant a short client conversation before schema is written.

---

## 3. Reporting: remove "Property Mandate" section, replace with P&L document — ✅ DONE (2026-07-17)

**Shipped:** "Property Mandates Summary" removed from `finance-assurance-board.tsx`'s report-type list and `reports-center-board.tsx`'s Finance group description; "Profit & Loss Statement" added in its place. Generating it now calls a real backend (`POST /api/finance/reports/pnl` → `generatePnLReport()`, `src/lib/services/finance/reports.ts`) that computes real revenue-by-stream + operating expenses + net profit over the selected period and persists an honest snapshot to `report_exports` with a genuine verification token (reusing the same hash/verify infrastructure as remittance advices) — replacing the previous `Math.random()` fake hash and hardcoded metrics. E2E-verified against real seed data (net profit, revenue breakdown, and expense figures all matched direct DB queries). The other four report types (Balance Sheet, Cash Flow, Trial Balance, Payroll Outlay) remain client-side simulations, unchanged — out of scope for this pass.

**Original scoping notes (superseded by the above):** `finance-assurance-board.tsx` (`/fin/reports/generate`) offers exactly 5 report types as buttons (line ~27, ~304-309): `Balance Sheet, Cash Flow Statement, Trial Balance Validation, Property Mandates Summary, Payroll Outlay Summary`. "Property Mandates Summary" is the literal item the client wants removed. **No P&L/Income Statement report type exists anywhere** — confirmed by searching the whole codebase for any profit-and-loss report artifact; the only real P&L today is the single dashboard card built in this same session (Item G1–G3 of the prior work). The "Generate" button in this UI is a pure client-side simulation (`handleGenerate()`, fake progress log, random hash, never touches the database) — it is not wired to the real `report_exports` table (`src/db/schema/documents.ts:61-77`), which does exist and is already used correctly by the remittance-advice and rent-receipt flows. The CEO/Admin Reports Center (`reports-center-board.tsx`) mirrors the same 5-type list and is explicitly empty (`reportCount: 0`, hardcoded).

**Proposed implementation:**
- Remove "Property Mandates Summary" from the report-type list in `finance-assurance-board.tsx` (and the matching description in `reports-center-board.tsx`'s Finance department group).
- Add "Profit & Loss Statement" as a report type.
- Build a real server-side P&L generator — extending `computeIncome()`/`computeExpenses()` with a revenue-by-stream and expense-by-category breakdown (reusing Item 5's aggregation) — that writes an honest snapshot into `report_exports` via the existing hash/verification infrastructure, rather than the current fake-progress simulation.

**Size:** Medium. The list edit is trivial; the real work is building an actual server-side P&L compute-and-persist path where today there's only a client-side illusion of one.

---

## 4. Collections: include landlords' accounts in the details section — NOT STARTED

Per Dennis's "quick wins first" sequencing decision (2026-07-17), this was not one of the three items scoped as buildable-with-no-prerequisite, so it remains its own follow-up effort. Scoping below is unchanged.

**Current state:** The Collections tab (`/fin/rentals/collections`, `rentals-ledger-board.tsx`) is entirely tenant-side — unit, tenant name, expected/collected rent, arrears age, payment history. Zero landlord fields (`grep -i landlord` returns nothing in that file), and like the reports board, it's hardcoded mock data with no live query at all. Landlord data does exist, but on a separate page: `property-mandates-board.tsx` (`/fin/mandates/active`) already has landlord name/email/phone and a real collected/management-fee/landlord-share split. The underlying schema for a landlord ledger is real and already built: `remittanceAdvices` (`src/db/schema/finance.ts:67-93`) carries `collectedKes / managementFeeKes / expensesKes / netRemittanceKes` per mandate per period.

**Proposed implementation:**
- Add a landlord-account view inside Collections' per-unit/per-property details (drawer or sub-tab), joining the tenant-collection row to that property's mandate + `remittanceAdvices` data.
- Prerequisite: both the Collections board and the Mandates board are currently unconnected mock UI (no live queries anywhere in either file) — a landlord-ledger view built "honestly" (this project's standing no-fabricated-data principle) requires connecting Collections to real transaction/mandate data first, not just adding a new field to the mock array.

**Size:** Medium–Large. The literal ask ("add a section") is small; doing it without fabricating data means connecting Collections to the real DB is an implicit prerequisite, not an optional cleanup.

---

## 5. Revenue: dropdown of revenue streams with per-stream detail on click — ✅ DONE (2026-07-17)

**Shipped:** `getRevenueStreamBreakdown()` (`src/lib/services/finance/reports.ts`, exposed via `GET /api/finance/revenue-streams`) computes real per-stream totals (Management Fees, Letting Commissions, Valuation Fees, Agreement Fees, Sales Commissions) from actual `transactions` rows, with per-transaction drill-down (date, counterparty/property, amount, notes). Two mock surfaces on Finance Overview were replaced with it: the "Revenue Breakdown" panel is now `RevenueStreamDropdown` (`src/components/finance/revenue-stream-dropdown.tsx`) — a real expandable list, click a stream to see its transactions — and the "Revenue Streams" pie chart (`finance-overview-charts.tsx`) now fetches real percentage shares instead of the old hardcoded `REVENUE_DISTRIBUTION_DATA` (whose labels like "Consultation" didn't correspond to any real transaction type). The old fully-mock `revenue-stream-chart.tsx` component was deleted as dead code. E2E-verified: management-fee stream correctly shows 10% of rent (not gross rent), and the two new item-1 revenue types resolve with correct counterparty/property names.

**Original scoping notes (superseded by the above):** There is no dedicated `/fin/revenue` page. Revenue breakdown exists in two places today, both **fully mock and disconnected from the real schema**:
- `RevenueStreamChart` (Finance Overview) — hardcoded `STREAM_DATA` with categories `Management, Letting, Lease, Commissions, Late Fees, Valuation`.
- A pie chart (`finance-overview-charts.tsx`) — hardcoded `REVENUE_DISTRIBUTION_DATA`: `Property Mgmt 45%, Letting Fees 25%, Consultation 15%, Valuation 15%`.

Neither chart's category labels match the real `transactionType` enum, and neither is fed by the `transactions` table — confirmed no query backs either component. The only real revenue figure anywhere is the single lump `incomeKes` on the CEO dashboard.

**Proposed implementation:**
- Build a real revenue-by-stream aggregation (group real `transactions` rows by `type`, apply the same per-type income logic as `computeIncome()`, sum `amountKes` per stream) — same "fetch then reduce in JS" convention used throughout this codebase.
- Present it as a dropdown/expandable list (rather than the current button-toggle chart), where selecting a stream reveals its own transaction-level detail (list or drawer).
- Depends on Item 1: "agreement fees" and "sales" only appear as distinct, meaningful streams once those enum values and their seed data exist.

**Size:** Medium. No schema change needed beyond Item 1; this is a real aggregation function plus a UI rebuild of an already-existing (but currently fake) breakdown view.

---

## 6. Paybill payment integration, especially for tenants — 🟡 SCAFFOLDED (2026-07-17), not live

Per Dennis's "scaffold now, wire later" decision, the structural pieces are built and E2E-verified against a simulated Daraja payload, but no live traffic can flow yet — real Safaricom credentials are still required.

**Shipped:**
- `tenant_payments` table (`src/db/schema/payments.ts`, migration `0021_exotic_naoko.sql`) tracking STK-push lifecycle: `pending → confirmed/failed/reversed`, with `checkoutRequestId`/`merchantRequestId` for matching Safaricom's async callback, and `reconciledTransactionId` linking to the real `transactions` row once confirmed.
- `initiateTenantPayment()` (`src/lib/services/payments/mpesa.ts`) — creates the pending row, but **refuses with a clear error** if `MPESA_CONSUMER_KEY`/`MPESA_CONSUMER_SECRET`/`MPESA_SHORTCODE`/`MPESA_PASSKEY` aren't set, rather than faking a successful STK push. E2E-verified this refusal leaves no orphaned rows.
- `handleMpesaCallback()` — parses Safaricom's real callback shape (`Body.stkCallback.{MerchantRequestID,CheckoutRequestID,ResultCode,CallbackMetadata}`), matches by `checkoutRequestId`, and on success creates a real `transactions` row (type `rent`) and links it back — E2E-verified end-to-end against a simulated Daraja success payload (real receipt number, real reconciled transaction, correct amount).
- API routes: `POST /api/payments/mpesa/stk-push` (initiation) and `POST /api/payments/mpesa/callback` (Safaricom's webhook — intentionally does not require session auth, since Safaricom's servers call it directly; always acks with Daraja's expected `{ResultCode:0, ResultDesc:"Success"}` shape regardless of internal outcome, per Daraja's retry semantics).
- Env var placeholders added to `.env.example` (`MPESA_ENV`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_URL`).

**Still needed before this is live:** real Daraja consumer key/secret, business shortcode/paybill number, and passkey from the client; the actual OAuth-token-fetch + STK-push-initiation HTTP call to Safaricom's `/mpesa/stkpush/v1/processrequest` endpoint (left unimplemented in `initiateTenantPayment()` — there's nothing to test it against yet); and, before production traffic, either an IP allowlist for Safaricom's servers or a hard-to-guess token in the callback URL path, since Daraja does not sign its callbacks.

There is also no tenant-facing session/auth in this codebase yet (a separate initiative — see `docs/SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md`), so `initiateTenantPayment()` is callable by staff on a tenant's behalf for now, not by a tenant directly.

**Original scoping notes (superseded by the above):** Fully greenfield — confirmed no partial scaffolding exists anywhere. `.env.example` has no Safaricom/Daraja/M-Pesa variable of any kind. No API route under `src/app/api` references M-Pesa, Daraja, or a payment webhook. Every "M-Pesa" string in the codebase today is a hardcoded UI option label in mock payment-method dropdowns (`rentals-ledger-board.tsx`, `payables-receivables-board.tsx`) — never a real integration. The only substantive reference is a design-intent paragraph in `docs/SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md:66,84-103`, proposing future `tenant_payments`/`misc_charge_payments` tables with an `mpesa` payment-method option — neither table exists yet.

**Proposed implementation:**
- New tables to track payment-intent state before reconciliation into `transactions` (e.g. `tenant_payments` per the portal spec, or a dedicated `stk_push_requests` table): `pending → confirmed/failed`, tied to a lease/tenant.
- New env vars: Daraja consumer key/secret, business shortcode/paybill number, passkey, callback base URL, sandbox/production flag.
- A webhook API route to receive Safaricom's payment confirmation callback, validating and reconciling into the real `transactions` ledger.
- **Blocker:** this cannot go further than scaffolding without real Safaricom Daraja API credentials and a live paybill/shortcode number from the client — I don't have these and can't obtain them. Per this assistant's standing operating rules, I also cannot execute or approve any actual money movement on the client's behalf; I can only build the integration code, not run a live transaction.

**Size:** Large, and externally blocked. No existing code to extend — this is a from-scratch payment-gateway integration, and the "especially for tenants" framing suggests it should key off the tenant-collections flow (Item 4) once that's real.

---

## Summary table

| # | Item | Size | Status (2026-07-17) | Blocked on |
|---|---|---|---|---|
| 1 | Revenue streams: agreement fees + sales | Small–Medium | ✅ Done | — |
| 2 | Payroll: Britam Tier II + payslips | **Large** | Not started | Client decision on Tier II rate/formula, payslip fields, approval workflow |
| 3 | Reporting: swap mandate summary → P&L | Medium | ✅ Done | — |
| 4 | Collections: landlord accounts in details | Medium–Large | Not started | Connecting Collections board to real data (prerequisite) |
| 5 | Revenue: stream dropdown with detail | Medium | ✅ Done | — |
| 6 | Paybill integration for tenants | **Large** | 🟡 Scaffolded | Safaricom Daraja credentials + paybill number from client |

Items 1, 3, and 5 shipped this pass — real data end to end, E2E-verified, no fabricated numbers. Item 6 is scaffolded (real schema, real refusal-when-unconfigured behavior, real reconciliation logic verified against a simulated callback) but cannot go live without real Daraja credentials. Items 2 and 4 remain their own follow-up efforts — 2 because it's a genuinely new module needing client input on Tier II specifics, 4 because doing it honestly requires first connecting the Collections board to real data rather than just adding a field to its existing mock array.
