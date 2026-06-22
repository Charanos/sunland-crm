# Sunland Finance Dashboard — Comprehensive Functional Spec

**Document status:** Drill-down of `SUNLAND_ERP_IMPLEMENTATION_SPEC.md` Section 5, expanded to the depth required to build Finance as its own near-standalone financial management system inside the ERP shell.
**Relationship to other documents:** This does not redefine the design system, the entity context, or the locked components. Where this document says "page," "modal," or "drawer," it means an instance of the existing, established components. It also does not re-litigate RBAC roles, which are inherited from the master spec (Section 3.2) and only narrowed here to Finance-specific actions (Section 6).
**Why this document exists:** Finance is the engine the rest of the ERP depends on. Every department workflow in the master spec either writes into Finance or reads out of it. A vague Finance module means every downstream module inherits that vagueness. This document removes the vagueness, page by page, field by field.

---

## 0. How to Use This Document

Read Section 3 first regardless of which page you're building. It defines the navigation shape every other section assumes. Then jump to the relevant subsection of Section 7 for the page you're implementing. Section 8 (Escalation) and Section 9 (Downstream Coordination) apply across every page and should be read once, fully, before building anything that touches money or an approval.

---

## 1. Assumptions Stated Up Front

The literal source of the existing sidebar and tab components isn't in front of me while writing this, so two structural decisions below are specified as the intended pattern, to be confirmed against the actual sidebar component before implementation rather than discovered by guessing mid-build:

1. **Tab navigation is route-based, not query-param-based.** Each tab inside a Finance section is a real Next.js route segment (e.g. `/admin/finance/ledger/journal-entries`), sharing a `layout.tsx` that renders the tab strip. This keeps every tab bookmarkable and shareable, consistent with the rest of the app favoring real routes over client-only state.
2. **Sidebar group badges exist or are added.** If the current sidebar component doesn't yet support a numeric badge on a group header and sub-link, this is a small, contained addition to that shared component (not a Finance-only fork of it), since HR, BD, and Front Office will want the same badge pattern for their own pending items once they're built.

Everything else below assumes the locked components, primitives, and store described in the master spec Sections 2 and 3.

---

## 2. Design Foundation (Carried Over, Not Restated in Full)

Finance uses, without modification: the Board layout (header → KPI tier → data tier), Modal system, Drawer system, Confirm Dialog, Toast system, `formatCompactKES()`, `title-serif`/`font-mono` typography, the four-tone semantic palette plus the amber "Awaiting Approval" tone, and 5–8 row pagination. See master spec Section 2 for the full token table. The one Finance-specific visual addition, introduced here because no other module needs it yet, is the **Statement layout**: a non-tabular, document-styled rendering used for the Balance Sheet and Cash Flow views (Section 7.1), which reads like a printed financial statement rather than a data table, while still using the same color tokens and `font-mono` figures.

---

## 3. Information Architecture: Sidebar Grouping & Tab Navigation

### 3.1 Sidebar Groups

Finance is large enough that a single expanded sidebar group becomes noisy. It is therefore split into finance concern groups in the dark command sidebar, while still sharing one `/admin/finance` landing page and one Finance shell. This mirrors how a corporate finance command center is actually operated: the Head of Finance may see every group, but a Payroll Officer or Rentals Officer should land on the same Finance Overview while only seeing the finance concerns their role can work.

```
Finance Command
 └─ Overview

Core Accounting
 └─ Ledger & Accounts                       [●1]

Property Revenue
 ├─ Rentals                                 [●12]
 ├─ Mandates                                [●3]
 └─ Service Fees

Treasury Control
 ├─ Payables & Receivables                  [●2]
 └─ Cheques                                 [●1]

People & Statutory
 ├─ Payroll
 └─ Affordable Housing

Finance Assurance
 └─ Reports
```

Each group renders as its own sidebar section. Links under the same sidebar group are the same links that appear as sibling pills in the in-page Finance control hub. For example, opening Rentals shows the Property Revenue hub with Rentals, Mandates, and Service Fees as sibling pills, then the Rentals-specific route tabs below that. A sub-link with no badge has nothing currently needing attention; this is the normal, healthy state, not a missing feature.

Role filtering is applied at this group boundary. Finance Head, GM, CEO, and Auditor/Compliance can see the broad Finance map. Rentals & Mandates Officer sees the Finance Overview plus Property Revenue pages. Payroll Officer sees the Finance Overview plus People & Statutory pages. Accounts/Finance Officers see the operational accounting and treasury pages. The Overview remains the default landing page for all Finance roles.

### 3.2 Tab Strip Within a Section

Clicking a sidebar link (e.g. "Mandates") lands on that section's default tab. The page then renders two navigation layers, both route-aware:

1. **Concern hub pills:** sibling sections from the same sidebar concern group, in the same compact card treatment used by the CEO/Admin dashboard's control surfaces.
2. **Route tabs:** the section's own tabs, directly below the hub card and above the KPI tier, using Brand Dark for the active underline and text.

Switching tabs is a route change, not a client-only state flip, so the KPI tier and data tier both re-fetch scoped to the new tab where the data genuinely differs (e.g. Mandates: Active vs Pending Approval are different filtered sets) and stay shared where it doesn't (e.g. the page-level KPI tier on Rentals stays constant across its four tabs since those KPIs describe the whole rentals book, not one slice of it).

### 3.3 Full Route Map for This Module

```
/admin/finance                                          Overview
/admin/finance/ledger/journal-entries                   Ledger & Accounts (default tab)
/admin/finance/ledger/chart-of-accounts
/admin/finance/ledger/trial-balance
/admin/finance/ledger/balance-sheet
/admin/finance/ledger/cash-flow
/admin/finance/rentals/collections                      Rentals (default tab)
/admin/finance/rentals/deficits
/admin/finance/rentals/vacancies
/admin/finance/rentals/defaulters
/admin/finance/mandates/active                          Mandates (default tab)
/admin/finance/mandates/pending-approval
/admin/finance/mandates/draft
/admin/finance/mandates/terminated
/admin/finance/mandates/[id]                             Mandate full-history page (edge case, see 7.3)
/admin/finance/payroll/runs                              Payroll (default tab)
/admin/finance/payroll/payslips
/admin/finance/payroll/remittances
/admin/finance/ap-ar/payables                            Payables & Receivables (default tab)
/admin/finance/ap-ar/receivables
/admin/finance/cheques/deposited                         Cheques (default tab)
/admin/finance/cheques/credited
/admin/finance/cheques/returned
/admin/finance/fees/rules                                Service Fees (default tab)
/admin/finance/fees/charges
/admin/finance/affordable-housing/units                  Affordable Housing (default tab)
/admin/finance/affordable-housing/allocations
/admin/finance/affordable-housing/levy
/admin/finance/reports/generate                          Reports (default tab)
/admin/finance/reports/library
/admin/finance/reports/verify
```

---

## 4. Global Finance Shell

Every page under `/admin/finance/*` shares a layout providing:

- **Persistent entity context**, read from the existing `useUIStore`, never re-implemented locally. Switching entities while inside Finance keeps the user on the same page/tab and re-fetches scoped data, the same behavior already established on the Executive dashboard.
- **Breadcrumb**: `Finance / [Section] / [Tab]`, using the existing breadcrumb pattern, not a new one.
- **Global Finance search**: a single search bar in the section header (Board layout's unified header) that searches across journal references, mandate references, payroll run IDs, cheque numbers, and creditor/debtor names within the active section's data tier, not a cross-section omni-search. Cross-section search is explicitly out of scope here; it would belong to a future global app search, not to Finance.
- **Quick Actions row**, visible on Overview and contextually on relevant sections, gated by the role matrix in Section 6.
- **Role-aware Finance Overview:** `/admin/finance` is the default landing page for every Finance role, equivalent to `/admin` for CEO/GM. The cards and quick actions are filtered by viewer role: a Payroll Officer sees payroll/remittance actions, a Rentals & Mandates Officer sees collections/mandate actions, Finance Head/GM/CEO see the full command surface.
- **Concern-aware hub navigation:** pages inside the same sidebar concern group show each other as sibling pills. Pages outside that concern group remain reachable from the sidebar, not from an over-wide in-page tab strip.

---

## 5. State, Data & Real-Time Architecture

### 5.1 Client State (Zustand)

A `useFinanceStore` slice, scoped to UI-only concerns, not a duplicate of server data:

```
useFinanceStore
  activeMandateDrawerId: string | null
  activeJournalDrawerId: string | null
  activeChequeModal: 'mark-credited' | 'mark-returned' | null
  rentalsFilters: { property, period, status }
  mandatesFilters: { division, status }
  // one filter object per page, reset on navigation away from that page
```

No financial totals, balances, or computed figures live in this store. Anything derivable from the database is fetched, never cached client-side as the source of truth.

### 5.2 Server State (TanStack Query)

Query keys are namespaced per resource so an invalidation in one place doesn't accidentally over-fetch or under-fetch elsewhere:

```
['finance', 'overview', entityId, period]
['finance', 'ledger', 'journal-entries', entityId, filters]
['finance', 'ledger', 'balance-sheet', entityId, asOfDate]
['finance', 'rentals', tab, entityId, filters]
['finance', 'mandates', tab, entityId]
['finance', 'mandate', mandateId]
['finance', 'payroll', tab, entityId, period]
['finance', 'ap-ar', tab, entityId]
['finance', 'cheques', tab, entityId]
['finance', 'fees', tab, entityId]
['finance', 'affordable-housing', tab, entityId]
['finance', 'reports', tab, entityId]
['finance', 'approvals', entityId]
```

### 5.3 Real-Time (Pusher)

One channel per resource family, not one giant `finance` firehose, so a user looking at Cheques doesn't re-render on every journal entry posted elsewhere:

| Channel | Events | Triggers |
|---|---|---|
| `private-finance-ledger` | `journal_entry.posted`, `journal_entry.voided` | Invalidates ledger + balance sheet + cash flow queries |
| `private-finance-rentals` | `collection.logged`, `defaulter.escalated` | Invalidates rentals queries, Overview KPI tier |
| `private-finance-mandates` | `mandate.activated`, `mandate.expense.logged`, `mandate.expense.decided` | Invalidates mandates + mandate detail queries |
| `private-finance-payroll` | `payroll.run.created`, `payroll.run.disbursed` | Invalidates payroll queries, notifies HR dashboard |
| `private-finance-cheques` | `cheque.credited`, `cheque.returned` | Invalidates cheques + ledger queries (credited posts a journal entry) |
| `private-finance-approvals` | `approval.requested`, `approval.decided`, `approval.escalated` | Invalidates badge counts everywhere, fires toast to requester and approver |

### 5.4 Caching (Upstash Redis)

Only aggregate, expensive-to-compute reads are cached. Anything that's a single-row lookup or a small filtered list is not, since caching it would add invalidation complexity for no real performance benefit.

| Cache key | TTL | Invalidated by |
|---|---|---|
| `finance:overview:{entityId}:{period}` | 5 min | `journal_entry.posted`, `collection.logged`, `mandate.expense.decided` |
| `finance:balance-sheet:{entityId}:{asOfDate}` | 15 min | `journal_entry.posted` for that entity |
| `finance:cash-flow:{entityId}:{period}` | 15 min | `journal_entry.posted` for that entity/period |
| `finance:collection-rate:{entityId}:{period}` | 10 min | `collection.logged` |

---

## 6. Finance-Specific Permissions Matrix

Narrows master spec Section 3.2 to concrete actions. "View" without an action column means read-only.

| Action | Finance Head | Finance Officer | Rentals & Mandates Officer | Payroll Officer | GM | CEO |
|---|---|---|---|---|---|---|
| Post journal entry | Yes | Yes | No | No | Yes | Yes |
| Void journal entry | Yes | No | No | No | Yes | Yes |
| Edit chart of accounts | Yes | No | No | No | No | No |
| Log rental collection | Yes | Yes | Yes | No | Yes | Yes |
| Escalate defaulter | Yes | Yes | Yes | No | Yes | Yes |
| Create mandate | Yes | No | Yes | No | Yes | Yes |
| Log mandate expense | Yes | No | Yes | No | Yes | Yes |
| Approve mandate / mandate expense | No* | No | No | No | Yes | Yes |
| Create payroll run | Yes | No | No | Yes | No | No |
| Approve & disburse payroll | No | No | No | No | Yes | Yes (informational) |
| Mark cheque credited (under threshold) | Yes | Yes | No | No | Yes | Yes |
| Mark cheque credited (over threshold) | Yes (co-signs) | No | No | No | Yes (co-signs) | Yes |
| Edit fee rules | Yes | No | No | No | No | No |
| Approve Affordable Housing programme participation | No | No | No | No | No | Yes |
| Generate / view reports | Yes | Yes | View only | View own | Yes | Yes |

*Finance Head can initiate and review but is intentionally excluded from approving Finance's own mandate and expense requests, since Finance Head is frequently the originator of the underlying record; approval sits with GM/CEO to preserve separation of duties. This is a deliberate control, not an oversight.

---

## 7. Page-by-Page Functional Specification

### 7.0 Overview (`/admin/finance`)

The page a Finance Head opens first every day. Built last in the implementation sequence (Section 15) because it aggregates every other page; building it first would mean building it against placeholder data.

**KPI Tier**

| Card | Formula | Notes |
|---|---|---|
| Collection Rate | `SUM(collected_amount) / SUM(expected_amount)` over `rental_ledger` for the active entity and period | Trend arrow vs. prior period |
| Revenue This Period | `SUM(journal_lines)` posted to revenue-type accounts | Explicitly excludes gross rent collected, which is a liability, not revenue (master spec 5.2) |
| Net Cash Position | Balance of cash/cash-equivalent accounts as of now | From Chart of Accounts subtype `cash` |
| Receivables Outstanding | Open balance of `accounts_receivable` only | Tenant rent arrears are the landlord's receivable, not Sunland's; they live in Rentals > Defaulters, not here |
| Payables Outstanding | Open balance of `accounts_payable` | |
| Pending Approvals (Finance) | `COUNT(approval_requests)` where status = pending and origin module = finance | Clickable, routes to the Unified Approvals Queue pre-filtered to Finance |

**Alerts Panel** (secondary row, amber/rose semantic cards, each clickable):

- Defaulters past 90 days, count and total deficit, links to Rentals > Defaulters.
- Mandates pending approval, count, links to Mandates > Pending Approval.
- Cheques awaiting bank confirmation beyond 5 business days, count, links to Cheques > Deposited.
- Statutory remittances due within 7 days, count and total amount, links to Payroll > Remittances.

**Data Tier**

- **Recent Activity feed**: latest journal postings, mandate activations, cheque status changes, and approval decisions, newest first, each row deep-linking to its source drawer. Read-only.
- **Revenue by Stream**: a chart reusing the existing revenue chart component from the Executive dashboard with a Finance-scoped dataset (management fees, letting fees, lease fees, sales commissions, late fees, valuation fees for the period). Same component, different query, per the carry-over rule in Section 2.

**Quick Actions** (Sunland Yellow buttons, gated by Section 6's matrix): New Journal Entry, Log Cheque, New Mandate, Run Payroll. Each opens its Modal directly from Overview without navigating away. On success, the toast includes a "View" link to the created record rather than auto-navigating, so the Finance Head can keep working from Overview if that's where they want to stay.

**Empty / loading / error states**: KPI cards show a skeleton shimmer (not a spinner) while loading, consistent with the existing dashboard. An entity with no ledger activity yet shows a single centered empty state across the whole page ("No financial activity recorded yet for [Entity]") rather than six separate empty KPI cards, since six blank cards reads as broken, not empty.

---

### 7.1 Ledger & Accounts (`/admin/finance/ledger`)

**Tabs:** Journal Entries · Chart of Accounts · Trial Balance · Balance Sheet · Cash Flow

#### Journal Entries (default)

- **Columns:** Date, Reference, Memo, Total Debit, Total Credit, Entered By, Status (`posted` / `draft` / `void`).
- **Filters:** date range, account, entity (inherited from global context).
- **Row action:** opens the Journal Entry Drawer (full line items, entered-by, timestamps, an Activity Log subsection per Section 8.4) with a "Void Entry" action restricted to Finance Head, behind a Confirm Dialog, which posts a reversing entry rather than deleting the original. Posted entries are never deleted; this is a hard rule, not a style preference.
- **Modal — New Journal Entry:** dynamic line rows (account selector, debit, credit, memo per line). Submit is blocked client-side and server-side unless `SUM(debits) === SUM(credits)`, enforced by a Zod `.refine()` on the client and a re-check in the API route, since a client-only check can be bypassed by a direct API call. On success: toast "Journal entry JE-0042 posted" with a "View" link, modal closes, table re-fetches via the `journal_entry.posted` Pusher event rather than a manual refetch call, so other Finance users watching the same page update live too.

#### Chart of Accounts

- Tree-style table grouped by type (Asset / Liability / Equity / Revenue / Expense), each row showing its current derived balance.
- **Modal — New Account:** Finance Head only, fields: name, type, subtype (e.g. `cash`, `landlord_payable`), parent account (optional, for sub-accounts).
- **Drawer:** transaction history for that account, a filtered view of `journal_lines`, with the same date-range filter as the main Journal Entries tab.

#### Trial Balance

- Read-only, computed, as-of date picker. Columns: Account, Debit Total, Credit Total. Export action (PDF/Excel) reuses the existing export infrastructure, no new export pipeline.

#### Balance Sheet

- Statement layout (Section 2), as-of date picker, Assets / Liabilities / Equity sections. "Generate QR-Verified PDF" button routes to Reports > Generate with the report type and date pre-filled rather than duplicating the generation logic on this page.

#### Cash Flow

- Period selector. Profit before tax → tax provision → profit after tax → depreciation add-back → net cash from operating / investing / financing, in that order, matching standard statement presentation. Revenue-by-stream chart, same component as Overview, period-scoped instead of single-period.

**Downstream coordination:** Balance Sheet and Cash Flow figures feed the Executive Oversight KPI tiles (master spec 9.1) and the Reports Center (7.9). No other department writes to this page directly; every other Finance page posts into it via the ledger, never around it.

---

### 7.2 Rentals (`/admin/finance/rentals`)

**Tabs:** Collections · Deficits · Vacancies · Defaulters

#### Collections (default)

- **Columns:** Unit, Tenant, Period, Expected, Collected, Status.
- **Filters:** property, period, status, division.
- **Bulk action:** "Mark Period Reconciled" for a multi-select of rows once manual entries for a period are confirmed against bank statements.
- **Modal — Log Manual Collection:** unit, period, amount, payment method, reference, optional receipt upload placeholder. There is no automated bank feed in this version of the spec; every collection is logged manually or imported in bulk, and that constraint is stated here so it isn't quietly assumed away during implementation.

#### Deficits

- Same row shape as Collections, filtered to `deficit > 0`, sorted descending. A tab-specific KPI card at the top: total outstanding deficit for the active filter set. Export action.

#### Vacancies

- Vacant units, days-vacant counter per row, a small historical vacancy-trend chart at the top of the tab.
- **Row action — "Notify Line Manager":** writes a flagged item onto the relevant Line Manager's Business Development dashboard (master spec Section 7), not a generic notification, this is explicit cross-department task creation.

#### Defaulters

- Tenants in arrears, aging buckets: current, 1–30, 31–60, 61–90, 90+ days.
- **Row action — "Escalate to Line Manager":** same cross-department mechanism as Vacancies, appearing on the Line Manager's "Collections Follow-up" widget.
- **Modal — Log Payment Plan:** records an agreed repayment schedule against the tenant; this does not touch the ledger by itself, it only changes what's expected going forward; the ledger only moves when an actual collection is logged against it later.

**Drawer (any row, any tab):** unit and tenant detail, full payment timeline, linked mandate reference, contact details, and tab-appropriate action buttons.

**Downstream coordination:** Defaulter escalation and vacancy notification both surface on the originating Line Manager's dashboard. Collection Rate feeds Overview (7.0) and Executive Oversight.

---

### 7.3 Mandates (`/admin/finance/mandates`)

**Tabs:** Active · Pending Approval · Draft · Terminated

- **Columns (all tabs):** Mandate Ref, Landlord, Property, Unit Count, Mandate Rate, Monthly Collectible Estimate, Status.
- **Pending Approval tab specifically:** each row shows an inline amber "Awaiting GM Approval" or "Awaiting CEO Approval" badge and, for users with approval rights, inline **Approve / Reject** buttons directly in the row, in addition to the item also appearing in the cross-department Unified Approvals Queue (master spec 9.2). This is a deliberate dual surface: a GM reviewing Finance day-to-day shouldn't have to leave the Mandates page to clear a mandate approval, but the CEO scanning everything cross-departmentally still sees it in one place.

**Mandate Detail (Drawer, default; full page for the edge case)**

Opens as a Drawer for the common case. If the mandate has more than 12 periods of collection history, a "View Full History" link inside the drawer pushes to `/admin/finance/mandates/[id]`, a dedicated page with the same sections but room for the full timeline, a pagination boundary rather than an infinite drawer.

Sections, in order:

1. **Mandate Terms:** rate, start date, status, with an edit action restricted to Finance Head and only with a reason field logged if the rate deviates from the standard 10%.
2. **Collections Timeline:** period-by-period collected amount, computed management fee, computed landlord remittance, read-only since these are generated values (master spec 5.4).
3. **Expenses Log:** every `mandate_expenses` row with its `approval_status` badge; items at `pending_gm` get inline Approve/Reject for GM/CEO viewers, same pattern as the Pending Approval tab.
4. **Landlord Remittance History:** past remittances with a "Mark Remitted" action requiring a proof-of-payment reference before it can be confirmed.
5. **Documents:** link to the mandate letter PDF (produced by Front Office, master spec 8.4).
6. **Activity Log:** every state change on this mandate, actor and timestamp, per Section 8.4.

**Modal — New Mandate:** landlord selector, property/unit selector, mandate rate (defaults to 10%, editable only with the deviation-reason rule above), start date. On submit, status is set to `draft` or `pending_approval` automatically based on the unit-count/value thresholds in master spec 4.7, the user does not choose this manually. Toast and redirect into the new Mandate Detail.

**Modal — Log Mandate Expense:** category, amount, period, optional receipt upload. Routes to `auto_approved` or `pending_gm` automatically based on the threshold table in master spec 4.7.

**Downstream coordination:** activating a mandate unlocks rental-ledger tracking for its units (7.2). Expense decisions notify the originating Line Manager (toast plus a status update on their own petty-cash view, master spec 7.3). Marking a remittance as paid is the signal Front Office/Accounts uses to close out that period for the landlord.

---

### 7.4 Payroll (`/admin/finance/payroll`)

**Tabs:** Runs · Payslips · Remittances

#### Runs (default)

- **Columns:** Period, Total Gross, Total Net, Total Statutory, Status (`draft` / `pending_gm` / `approved` / `disbursed`).
- **Row action:** opens a Drawer with the full breakdown by department, a "Submit for Approval" button for the Payroll Officer, and an "Approve & Disburse" button visible only to GM, behind a Confirm Dialog. This is the one Finance action that always requires GM sign-off regardless of amount (master spec 4.7); there is no auto-approve path here, by design.
- **Modal — New Payroll Run:** pulls aggregated `time_logs` from HR for the selected period as a read-only preview before the run is created. Hours are not editable from Finance; HR is the source of truth for hours (master spec 4.2), and Finance editing them here would create two conflicting versions of the truth.

#### Payslips

- Searchable by employee and period. Row opens a payslip preview Drawer: gross, itemized deductions (PAYE, NSSF, NHIF/SHIF, Affordable Housing Levy), net. "Download PDF" reuses the Reports/QR infrastructure (7.9). "Resend to Employee" is a placeholder action pending whatever notification channel (email/SMS) is wired up elsewhere in the system; this spec defines the trigger, not the delivery mechanism.

#### Remittances

- Per statutory body (KRA/PAYE, NSSF, SHIF, Affordable Housing Fund): amount due, due date, status. "Mark Remitted" requires a reference number before it can be confirmed.

**Downstream coordination:** this entire tab is HR feeding Finance. Run status is visible, read-only, on HR's own payroll widget. Remittance due-dates feed the Overview Alerts Panel (7.0).

---

### 7.5 Payables & Receivables (`/admin/finance/ap-ar`)

**Tabs:** Payables · Receivables

- **Columns (both tabs):** Vendor/Client, Amount, Due Date, Aging Bucket, Status.
- **KPI tier (page-level, shared across both tabs):** Total Payables, Total Receivables, Net Position (Receivables − Payables), Overdue Count.
- **Row action:** "Record Payment" (Payables) or "Record Receipt" (Receivables) modal: amount, date, reference, posts the corresponding journal entry automatically rather than requiring a separate manual journal entry for the same event. "Mark Disputed" toggle freezes aging-bucket escalation on that row until cleared.
- **Drawer:** full transaction history for that creditor or debtor.

**Downstream coordination:** payables frequently originate from Operations module contractor invoices; receivables can originate from Valuers Ltd client billing or one-off BD-sourced fees. Both are written into this module by their originating workflow rather than re-keyed manually where avoidable.

---

### 7.6 Cheques (`/admin/finance/cheques`)

**Tabs:** Deposited · Credited · Returned

- **Columns:** Cheque #, Payer, Amount, Deposited Date, Credited Date (if applicable), Status.
- **Row action — "Mark Credited":** if amount is at or below KES 500,000, this completes immediately and is the single action on this entire page that posts a journal entry (master spec 4.6); above that threshold, it instead writes an `approval_requests` row requiring dual sign-off from Finance Head and GM (master spec 4.7), and the row shows the amber awaiting-approval badge until both have signed.
- **Row action — "Mark Returned":** requires a reason, triggers a debtor follow-up task rather than any ledger entry.

This page is the clearest place in the whole Finance module to see the deposited-versus-credited rule in action: a cheque can sit at `deposited` indefinitely with zero financial-statement impact, exactly as intended.

---

### 7.7 Service Fees (`/admin/finance/fees`)

**Tabs:** Fee Rules · Charges Log

- **Fee Rules:** `service_fee_rules` table (fee type, calculation method, rate or flat amount, scope). Edit modal restricted to Finance Head, since a rule change here affects revenue recognition across every active lease, mandate, and sale it applies to.
- **Charges Log:** every `service_fee_charges` row, filterable by fee type and status, each linking back to its originating record (a specific lease, mandate, or sale) rather than existing as a floating, unexplained line item.

---

### 7.8 Affordable Housing (`/admin/finance/affordable-housing`)

**Tabs:** Units · Allocations · Levy

- **Units:** `affordable_housing_units`, linked property/unit, scheme status.
- **Allocations:** allottee eligibility records. New programme participation (as opposed to routine allocation updates within an already-approved programme) is CEO-approval-gated per master spec 5.8 and 4.7, since it's a government-facing commitment, not a routine transaction.
- **Levy:** the 1.5% employer / 1.5% employee Affordable Housing Levy, sourced from Payroll (7.4), shown here with a compliance-history view rather than duplicated as a separate manual entry point.

---

### 7.9 Reports (`/admin/finance/reports`)

**Tabs:** Generate · Library · Verify

- **Generate:** select report type (Balance Sheet, Cash Flow, Mandate Statement, Payroll Summary, Trial Balance), date range, entity. Produces a PDF with an embedded QR code per master spec 5.9, and writes a `report_exports` row.
- **Library:** searchable history of every generated report, with a re-download action. Nothing here is regenerated on view; the PDF from the moment of generation is the canonical artifact, since a report whose numbers silently change after the fact undermines the entire point of the QR verification feature.
- **Verify:** accepts a scanned token, returns an authenticity confirmation, mirroring the public-safe view described in master spec 5.9 for anyone verifying a printed document without full system access.

---

## 8. Escalation & Approval UX, in Full

### 8.1 Where Approvals Surface

Every approvable Finance action surfaces in two places at once, deliberately:

1. **Inline, in context,** on the page where the item lives (Mandates Pending Approval tab, Cheques Deposited tab for over-threshold items, Payroll Runs for disbursement), so a GM working through Finance day-to-day never has to leave the page to act.
2. **In the Unified Approvals Queue** (`/admin/approvals`, master spec 9.2), so the CEO or GM scanning everything cross-departmentally sees it alongside HR, BD, and Front Office items in one list.

Both surfaces read from the same `approval_requests` table; there is no separate Finance-only approvals table to keep in sync.

### 8.2 The Approve / Reject Interaction

Clicking Approve or Reject opens a small Confirm Dialog (not a full Modal, since the context is already visible on the page) showing: what's being approved, the amount if relevant, and an optional notes field for Approve, a **required** notes field for Reject, enforced by Zod, since "rejected, no reason given" is not an acceptable end state for an originator to receive.

### 8.3 What Happens on Decision

- **Approve:** `approval_requests.status = approved`, `decided_by` and `decided_at` set. The underlying action executes immediately: the journal entry posts, the remittance calculates, the payroll run disburses, whatever the specific action was. A toast fires for the approver. A second toast fires for the original requester via the `private-finance-approvals` Pusher channel. The item disappears from both the inline view and the Unified Approvals Queue. An Activity Log entry (8.4) is appended to the underlying record.
- **Reject:** `approval_requests.status = rejected`, `decision_notes` stored. The originating record reverts to an editable draft state where applicable (e.g. a rejected mandate expense returns to the Line Manager's queue as editable, rather than being deleted). The requester is notified with the rejection reason visible in the toast, not just a generic "rejected" message.
- **Escalate (GM → CEO only):** for borderline cases, a GM can escalate instead of deciding. `escalated_from` is set, `required_approver_role` flips to CEO, the item moves from the GM's pending view to the CEO's. The GM is notified once the CEO decides, closing the loop rather than leaving the GM wondering what happened to something they passed up.

### 8.4 Activity Log / Audit Trail

Every Drawer in the Finance module (Journal Entry, Mandate, Cheque, Payroll Run, Creditor/Debtor) includes an Activity Log section: every created, edited, approved, rejected, and voided event on that record, with actor and timestamp, oldest at the bottom. This is what makes "robustness" a verifiable property of the build rather than a claim: any disputed figure can be traced to exactly who did what, when. This is not optional for any of the modules above; it is part of the Drawer pattern for Finance specifically, the same way the Toast system is part of every CRUD action.

---

## 9. Cross-Department Downstream Coordination Matrix

| Finance action | Department affected | What changes there |
|---|---|---|
| Vehicle-adjacent mandate cost exceeds threshold | Front Office | Vehicle request queue reflects GM hold if linked to the same approval cycle |
| Defaulter / vacancy escalated | Business Development (Line Manager) | Appears on the Line Manager's Collections Follow-up widget |
| Mandate expense approved/rejected | Business Development (Line Manager) | Petty cash status updates on their BD dashboard, toast notification |
| Mandate activated | Finance (Rentals) | Unit-level rental ledger tracking begins |
| Payroll run created | HR | Payroll widget on HR dashboard reflects draft → pending → disbursed status, read-only |
| HR Payroll Liaison submits period hours | Finance Payroll | New payroll run becomes createable for that period; HR cannot silently edit submitted hours afterward |
| HR career change approved | Finance Payroll | Salary band update is visible before the next payroll run is generated |
| Payroll disbursed | Executive | Total payroll cost KPI updates on Executive Oversight |
| Landlord remittance marked paid | Front Office | Closes out that period's mandate paperwork on the Front Office side |
| Front Office trip mileage/fuel logged | Finance AP/AR | Posts as an Accounts Payable office operating expense, not a financially invisible trip note |
| Front Office office petty cash reconciliation variance | Finance AP/AR | Flagged for Finance review using the same reconciliation pattern as BD property petty cash |
| Cheque credited | Ledger (this module) | Only trigger anywhere in the Cheques page that posts a journal entry |
| AP payment recorded | Operations (if contractor-originated) | Contractor invoice status updates on the Operations module |
| BD closes a deal won | Finance Service Fees | Commission charge is created by Finance's fee rules engine; BD never computes the commission amount |
| BD property petty cash expense logged | Finance Mandates | Appears in the mandate's Expenses Log, auto-approved or routed to GM/CEO by Finance thresholds |
| New Affordable Housing programme participation | Executive (CEO) | Requires explicit CEO approval before any allocation activity proceeds |
| Any approval decision | Executive | Item clears from the Unified Approvals Queue |
| Report generated | Executive (Reports Center) | Appears in the consolidated Reports Center, master spec 9.3 |
| CEO edits approval threshold | Finance approval gates | New threshold is read from System Administration configuration on the next evaluated request, not hardcoded in Finance |

---

## 10. Redirect & Navigation Rules

| After this action | User lands here | What they see |
|---|---|---|
| Post journal entry | Stays on Journal Entries tab | New row visible via real-time refetch, toast with "View" link to the Drawer |
| Void journal entry | Stays on Journal Entries tab | Original marked void, reversing entry appears as a new row |
| Create mandate | Mandate Detail (Drawer) for the new mandate | Status shown as draft or pending approval, never silently routed to Active |
| Approve mandate (inline) | Stays on current tab | Row disappears from Pending Approval, toast confirms, requester separately notified |
| Log mandate expense | Mandate Detail stays open if action originated there; otherwise closes Modal and returns to Mandates list | Toast indicates auto-approved or pending GM |
| Mark cheque credited (under threshold) | Stays on Deposited tab | Row moves to Credited tab on next data refresh, toast confirms ledger posting |
| Mark cheque credited (over threshold) | Stays on Deposited tab | Row shows amber pending-approval badge, does not move until approved |
| Approve & disburse payroll | Stays on Runs tab | Status updates to disbursed, toast confirms, HR notified separately |
| Generate report | Reports > Library | New entry at top of list, ready for download immediately |
| Reject any approval | Returns to the originator's relevant page (not the approver's) | Originator sees the item back in an editable state with the rejection reason visible |

---

## 11. Notification & Badge System

- **Sidebar concern badges** (Section 3.1): each Finance concern group carries the sum of pending-approval items plus SLA-breached alerts inside that group. Color reflects severity: amber if everything is within normal handling time, rose if anything has breached its SLA window (cheques over 5 business days undecided, mandate approvals over 48 hours undecided).
- **Sub-link badges:** each section's own count, same severity coloring logic, computed independently rather than as a fraction of the group total, so a single page's badge is always accurate on its own.
- **Toasts:** every CRUD and approval action, per the existing global Toast system. No new notification surface is introduced; Finance does not get its own bell icon or notification center distinct from what the rest of the app uses, since the badge-plus-toast combination already covers "what needs my attention" and "what just happened" without adding a third surface to maintain.

---

## 12. Component Inventory

| Component | Used on |
|---|---|
| `FinanceOverviewBoard` | 7.0 |
| `FinanceAlertsPanel` | 7.0 |
| `FinanceActivityFeed` | 7.0 |
| `RevenueByStreamChart` (shared with Executive dashboard, new dataset) | 7.0, 7.1 (Cash Flow) |
| `LedgerJournalTable`, `JournalEntryModal`, `JournalEntryDrawer` | 7.1 |
| `ChartOfAccountsTable`, `AccountModal`, `AccountDrawer` | 7.1 |
| `TrialBalanceStatement`, `BalanceSheetStatement`, `CashFlowStatement` | 7.1 |
| `RentalCollectionsTable`, `DeficitsTable`, `VacanciesTable`, `DefaultersTable` | 7.2 |
| `ManualCollectionModal`, `PaymentPlanModal`, `RentalUnitDrawer` | 7.2 |
| `MandatesTable`, `MandateDetailDrawer`, `MandateFullHistoryPage` | 7.3 |
| `NewMandateModal`, `MandateExpenseModal`, `InlineApprovalWidget` | 7.3, also reused on 7.6 |
| `PayrollRunsTable`, `PayrollRunDrawer`, `NewPayrollRunModal` | 7.4 |
| `PayslipsTable`, `PayslipDrawer` | 7.4 |
| `StatutoryRemittanceTable` | 7.4, 7.8 (Levy tab) |
| `PayablesTable`, `ReceivablesTable`, `RecordPaymentModal`, `RecordReceiptModal`, `CreditorDebtorDrawer` | 7.5 |
| `ChequesTable`, `MarkCreditedModal`, `MarkReturnedModal` | 7.6 |
| `FeeRulesTable`, `FeeRuleModal`, `ChargesLogTable` | 7.7 |
| `AHUnitsTable`, `AHAllocationsTable` | 7.8 |
| `ReportGenerator`, `ReportLibraryTable`, `ReportVerifyPanel` | 7.9 |
| `FinanceActivityLog` (shared across every Drawer in this module) | All drawers, Section 8.4 |
| `FinanceApprovalBadge`, `SidebarGroupBadge` (extends existing sidebar component) | Section 3.1, 11 |

---

## 13. Performance & Caching Summary

Covered in full in Section 5.4. The short version: only Overview, Balance Sheet, and Cash Flow are cached, because they're the only views that aggregate across large numbers of rows rather than reading a filtered list. Every cache entry is invalidated by the specific Pusher event that could change its underlying numbers, never by a blanket time-only expiry alone, so a Finance user never sees stale figures after they themselves just posted something.

---

## 14. Finance-Specific Verification Checklist

In addition to the generic checklist in the master spec (Section 12):

- [ ] Debits always equal credits on every posted journal entry, enforced server-side, not just in the form.
- [ ] Management fee is a generated column (`collected_amount * mandate_rate`), confirmed not computed in a component.
- [ ] A cheque at `deposited` status produces zero journal entries; only `credited` does.
- [ ] Every threshold in master spec 4.7 that applies to Finance is enforced server-side, with a visible amber badge client-side.
- [ ] Rejecting an approval is impossible without a notes field filled in.
- [ ] Every Drawer in this module has a working Activity Log section.
- [ ] A generated QR-verified report, downloaded and re-scanned, returns the correct authenticity confirmation.
- [ ] Tenant rent arrears never appear in the Receivables Outstanding KPI on Overview; they only appear under Rentals > Defaulters.
- [ ] Sidebar badges and the Unified Approvals Queue always agree on count, since they read the same table.

---

## 15. Build Sequence for This Module

A finer-grained breakdown of master spec Phases 1–3, specific to Finance:

1. Ledger & Accounts shell, Journal Entry CRUD, debits-equal-credits enforcement.
2. Chart of Accounts, Trial Balance, Balance Sheet, Cash Flow statement views (these are read-only once the ledger exists, so they follow quickly once step 1 is solid).
3. Rentals: Collections, Deficits, Vacancies, Defaulters.
4. Mandates, including the inline approval widget, since this is the highest-value, most error-prone logic in the spec and benefits from the most real-world testing time.
5. Approval Engine integration test specifically across Mandates and Cheques together, since they're the two modules most likely to reveal a gap in the shared approval flow before it's relied on elsewhere.
6. Payroll, sequenced after HR's time-tracking module exists (master spec Phase 4), since Payroll cannot meaningfully be tested without real hours to aggregate.
7. Payables & Receivables.
8. Cheques.
9. Service Fees.
10. Affordable Housing.
11. Reports & QR verification, once there's real Balance Sheet, Cash Flow, Mandate, and Payroll data worth reporting on.
12. Overview, last, deliberately, since it's a rollup of everything above and is only meaningful once the pages it summarizes have real data flowing through them.
