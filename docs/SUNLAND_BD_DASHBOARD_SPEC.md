# Sunland Business Development Dashboard — Comprehensive Functional Spec

**Document status:** Drill-down of `SUNLAND_ERP_IMPLEMENTATION_SPEC.md` Section 7, expanded to the depth required to build Business Development (Line Managers) as its own near-standalone relationship and pipeline management system inside the ERP shell, matching the rigor of `SUNLAND_FINANCE_DASHBOARD_SPEC.md` and `SUNLAND_HR_DASHBOARD_SPEC.md`.
**Relationship to other documents:** Inherits the design system, entity context, locked components, and RBAC role list without modification. Where Finance's challenge was financial-logic integrity and HR's was access control, BD's is structural: almost nothing BD does is self-contained. A vehicle needs Front Office. A mandate needs Finance's sign-off. A commission needs Finance's fee engine. BD is a coordination layer more than an execution layer, and that shapes this document more than any single page within it.

> **Updated 2026-07-08 — role names superseded, structure/flows unchanged (ADR 013):** "Line Manager" throughout this document no longer exists as a role. Its consolidated successor, `property_manager`, now reports to a new department head, **Head of Strategy** (`head_of_strategy`), rather than being the top of its own chain. Everywhere this doc says "Line Manager" as the senior/decision-making tier (territory ownership, team performance views, approvals), read "Head of Strategy"; everywhere it means the working agent, read "Property Manager." The page structure, territory model, and request-transparency principles below are otherwise unchanged and still the design to build against. Property Managers additionally now carry tenant-facing responsibility (complaints, arrears, misc charges — `SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md`), not just the landlord/pipeline scope this document describes.

---

## 0. How to Use This Document

Read Section 6 before any page in Section 8. It defines BD's two governing principles, territory ownership and request transparency, that every page below assumes. Section 9 is shorter than its Finance and HR equivalents for a specific reason explained there: BD mostly originates requests rather than deciding them, so the interesting UX problem is tracking, not approving.

---

## 1. Assumptions Stated Up Front

1. **Tab navigation is route-based**, same convention as Finance and HR, to be confirmed against the live components before build.
2. **Listings, properties, units, and leases are not redefined here.** They're inherited from the base CRM schema this ERP is built on top of. This document specs how BD's funnel and dashboard work with that existing data, not a new property data model.
3. **One new route is added beyond the master spec's BD list**, `/admin/business-development/liaison`, covering master spec Section 7.4 (Front Office Liaison), which the original route map implied but didn't give a dedicated home. Same rationale pattern as Payroll Liaison in the HR spec: an implied cross-department workflow gets a real page rather than living invisibly between two modules.
4. **BD does not compute its own commission, fee, or mandate-rate figures, anywhere.** Every place this might be tempting is called out explicitly in Section 6.4, because the instinct to "just calculate it here for convenience" is exactly the kind of duplicated logic that broke the rule in Finance's own spec if it isn't headed off early.

---

## 2. Design Foundation (Carried Over, Not Restated in Full)

Same as Finance Section 2 and HR Section 2: Board layout, Modal/Drawer/Confirm Dialog/Toast systems, `formatCompactKES()` wherever money appears (petty cash, pipeline value, deal value), `title-serif`/`font-mono`, the five-tone semantic palette. No new visual primitive is introduced. The one layout BD reuses heavily that Finance and HR used more lightly is the **Kanban/staged board** pattern already implied by the sales funnel concept; this is specified in 8.1 as a variant of the existing data tier, not a new component family, columns instead of rows, same card styling conventions as the rest of the system.

---

## 3. Information Architecture: Sidebar Grouping & Tab Navigation

### 3.1 Sidebar Group

```
Business Development                        [●6]
 ├─ Overview
 ├─ Landlords                                [●2]
 ├─ Listings & Funnel
 ├─ Petty Cash                               [●1]
 ├─ Liaison & Requests                       [●3]
 └─ Agent KPIs & Goals
```

Five sub-links plus Overview, narrower than Finance's nine or HR's nine, because BD's actual scope (master spec 7.1–7.5) is genuinely smaller. This document goes deep rather than wide to compensate; narrower scope is not an excuse for thinner detail.

### 3.2 Tab Strip Within a Section

Same mechanism as Finance and HR: route-based tabs, Brand Dark active state, page-level KPI tier shared across a section where the data describes the whole section, tab-scoped where it describes a slice.

### 3.3 Full Route Map for This Module

```
/admin/business-development                                       Overview
/admin/business-development/landlords/directory                   Landlords (default tab)
/admin/business-development/landlords/mandate-status
/admin/business-development/landlords/prospecting
/admin/business-development/listings/active                       Listings & Funnel (default tab)
/admin/business-development/listings/funnel
/admin/business-development/listings/closed
/admin/business-development/petty-cash/float                      Petty Cash (default tab)
/admin/business-development/petty-cash/expenses
/admin/business-development/petty-cash/reconciliation
/admin/business-development/liaison/vehicle-requests               Liaison & Requests (default tab, new)
/admin/business-development/liaison/mandate-letters
/admin/business-development/liaison/paperwork
/admin/business-development/kpis/team                              Agent KPIs & Goals (default tab, Line Manager view)
/admin/business-development/kpis/my-performance                    (Agent view)
/admin/business-development/kpis/time-logs
```

---

## 4. Global BD Shell

Same shape as Finance Section 4 and HR Section 4: persistent entity context from `useUIStore`, breadcrumb (`Business Development / [Section] / [Tab]`), section-scoped search (landlord names, listing references, deal names within the active section), Quick Actions row gated by Section 7's matrix. One BD-specific addition: the shell renders a persistent **division indicator** distinct from the global entity switcher, since a Line Manager's data is naturally scoped to their division (Commercial, Residential, or Valuers) within whichever entity is active, and that scoping needs to be visible at all times, not just implied by who's logged in.

---

## 5. State, Data & Real-Time Architecture

### 5.1 Client State (Zustand)

```
useBDStore
  activeLandlordDrawerId: string | null
  activeDealDrawerId: string | null
  activeFloatId: string | null
  funnelFilters: { stage, agent, dateRange }
  landlordFilters: { division, mandateStatus }
  pettyCashFilters: { property, period }
```

No deal values, commission figures, or float balances are held longer than the relevant drawer or modal is open. Every figure shown is fetched, never locally computed and cached as if it were authoritative.

### 5.2 Server State (TanStack Query)

```
['bd', 'overview', entityId, divisionId, viewerScope]
['bd', 'landlords', tab, entityId, divisionId, filters]
['bd', 'landlord', landlordId]
['bd', 'listings', tab, entityId, divisionId, filters]
['bd', 'deal', dealId]
['bd', 'petty-cash', tab, propertyOrMandateId]
['bd', 'liaison', tab, entityId, divisionId]
['bd', 'kpis', tab, entityId, divisionId, period]
```

`viewerScope` on the Overview key (and implicitly on every list query) carries whether the viewer is a Line Manager (division-wide) or a BD Agent (assigned-only), per Section 6.1. This is a filtering distinction, not an access-control wall the way HR's `viewerRole` was; the data isn't hidden in tiers, it's scoped to what's relevantly yours, the same way a CRM scopes a salesperson's pipeline to their own accounts.

### 5.3 Real-Time (Pusher)

| Channel | Events | Triggers |
|---|---|---|
| `private-bd-landlords` | `landlord.added`, `mandate-status.changed` | Invalidates Landlords queries |
| `private-bd-funnel` | `deal.stage-changed`, `deal.closed` | Invalidates Listings & Funnel queries, Overview KPI tier |
| `private-bd-petty-cash` | `expense.logged`, `topup.requested`, `topup.decided` | Invalidates Petty Cash queries |
| `private-bd-liaison` | `vehicle-request.status-changed`, `mandate-letter.status-changed`, `paperwork.status-changed` | Invalidates Liaison queries, the page most dependent on real-time since its entire purpose is live status |
| `private-bd-kpis` | `goal.set`, `kpi.recalculated` | Invalidates Agent KPIs queries |

`private-bd-liaison` is the busiest channel by design. A liaison request that updates silently defeats the entire point of the page (Section 6.2); every state change on a tracked request fires here the moment it happens in Finance or Front Office, not on the next scheduled refetch.

### 5.4 Caching (Upstash Redis)

| Cache key | TTL | Invalidated by |
|---|---|---|
| `bd:overview:{entityId}:{divisionId}:{viewerScope}` | 5 min | Relevant domain events per Section 5.3 |
| `bd:team-performance:{divisionId}:{period}` | 15 min | `deal.closed`, `kpi.recalculated` |
| `bd:pipeline-value:{divisionId}` | 10 min | `deal.stage-changed` |

Liaison & Requests is deliberately never cached. A page whose entire value is "what's the current status" must always read live or near-live; caching it would mean occasionally showing a stale status on the one page where that's the most visible kind of wrong.

---

## 6. Territory, Ownership & Liaison Transparency

BD's two cross-cutting design principles, read before any page below.

### 6.1 Territory and Ownership Model

Every landlord, listing, and lead has exactly one owning Line Manager, set by division, and may additionally have one assigned BD Agent under that Line Manager. A BD Agent sees only records assigned to them. A Line Manager sees their entire division. This is an ownership and accountability boundary, not a confidentiality boundary the way HR's medical data was; there's no sensitivity to hide, only a scope to keep clear, so the treatment is simpler than HR's absence-over-restriction rule: server-side filtering on the query, not route- or sidebar-level hiding. A BD Agent's sidebar looks identical to a Line Manager's; their data underneath it is just narrower.

**Reassignment:** a Line Manager can reassign a landlord or lead from one Agent to another (departure, territory change, workload balancing). This is logged in that record's Activity Log with the prior and new assignee, since pipeline history shouldn't silently lose its provenance when ownership changes hands.

### 6.2 Request Transparency, Not Black Boxes

This is the principle that defines the Liaison & Requests page (8.3) and shapes the Petty Cash and Landlords pages too: anything BD hands to another department for execution, a vehicle, a mandate letter, a mandate activation, a petty cash top-up, gets a standardized, always-visible status, never a submission that disappears until someone happens to follow up manually.

**Standard status vocabulary, used identically across every liaison workflow regardless of which department executes it:**

```
Requested → In Progress → Awaiting Approval → Completed
                                            ↘ Declined
```

A vehicle request and a mandate letter request look different in content but identical in how their status reads, so a Line Manager scanning the Liaison page doesn't have to learn a different status language per request type.

### 6.3 Petty Cash Balance Is a Derived View, Not a Second Ledger

A property or mandate's petty cash float balance, as shown anywhere in this module, is computed from the same `mandate_expenses` rows Finance already owns (master spec 5.4), filtered to that float and netted against logged replenishments. It is never an independently maintained number that could drift from Finance's record of the same transactions. This is the same principle Finance's own spec states for its ledger (no subsystem maintains its own running balance), applied here to keep BD's convenience view honest rather than competing with Finance's authoritative one.

### 6.4 BD Does Not Compute Money It Doesn't Own

Three specific places this temptation shows up, named explicitly so they aren't quietly reinvented during implementation:

- **Mandate rate** (default 10%): displayed read-only on the Mandate Status tab (8.0's Landlords section), never editable from BD. Only Finance Head can deviate it, with a reason field, per the Finance spec.
- **Sales commission:** when a deal closes (8.2), BD submits deal value, deal type, and the closing agent. It does not calculate the commission amount. Finance's `service_fee_rules` engine (Finance spec 7.7) computes the charge from that submission.
- **Petty cash reimbursement amount:** BD logs the expense and the amount spent; whether that amount is auto-approved or requires GM sign-off, and what gets deducted from the landlord's remittance, is Finance's threshold logic (master spec 4.4, 4.7), not a calculation BD performs first.

---

## 7. BD-Specific Permissions Matrix

| Action | Line Manager | BD Agent | GM | CEO |
|---|---|---|---|---|
| View landlords/listings | Full (own division) | Assigned only | Full (all divisions) | Full (all divisions) |
| Create/edit landlord record | Yes | No (can flag for review) | Yes | Yes |
| Move deal through funnel stages | Yes | Yes (own leads) | View | View |
| Close a deal (won/lost) | Yes | Yes (own leads) | View | View |
| Create landlord prospecting record | Yes | No | Yes | Yes |
| Log petty cash expense | Yes | Yes (against assigned float) | View | View |
| Request float top-up | Yes | No (routes through Line Manager) | Approve per threshold | Approve per threshold |
| Reconcile petty cash | Yes (jointly with Finance) | No | View | View |
| Submit vehicle request | Yes | Yes | Approve if escalated | Approve if escalated |
| Submit mandate letter draft request | Yes | No | View | View |
| Set agent goals | Yes | No | View | View |
| View team performance | Yes (own division) | No (self only) | Yes (all divisions) | Yes (all divisions) |
| Reassign landlord/lead to another agent | Yes | No | No | No |

---

## 8. Page-by-Page Functional Specification

### 8.0 Overview (`/admin/business-development`)

Built last (Section 16), since it rolls up every other page, both BD's outgoing requests and Finance's incoming escalations into it.

**KPI Tier**

| Card | Formula | Notes |
|---|---|---|
| Active Listings | `COUNT(listings)` where status = active, scoped to division/viewer | |
| Pipeline Value | `SUM(deal_value)` across funnel entries not yet closed | Links to Listings & Funnel |
| Conversion Rate (period) | `COUNT(closed_won) / COUNT(funnel_entries_total)` for the period | |
| Active Mandates | `COUNT(property_mandates)` where status = active, division-scoped | Read from Finance's mandate data, not duplicated |
| Floats Needing Top-Up | `COUNT(petty_cash_floats)` where balance < configured threshold | Links to Petty Cash > Float |
| Pending Liaison Requests | `COUNT` of all liaison requests not yet Completed/Declined | Links to Liaison & Requests |

**Alerts Panel**, deliberately bidirectional:

- **Outgoing (BD-initiated, awaiting another department):** mandates pending GM/CEO approval, liaison requests stalled beyond a configurable handling window.
- **Incoming (escalated to BD from elsewhere):** defaulters and vacancies escalated from Finance's Rentals module (Finance spec 7.2) awaiting Line Manager follow-up, displayed here exactly as they appear on the originating Finance page, not a re-summarized version of them.

**Data Tier**

- **Recent Activity feed:** funnel stage changes, mandate status changes, liaison status changes, petty cash entries, newest first, each deep-linking to its source.
- **Pipeline by Stage chart:** reuses the shared chart component (Section 2), dataset is deal count and value per funnel stage.

**Quick Actions:** New Landlord, New Lead, Log Petty Cash Expense, New Vehicle Request.

---

### 8.1 Landlords (`/admin/business-development/landlords`)

**Tabs:** Directory · Mandate Status · Prospecting

#### Directory (default)

- **Columns:** Landlord Name, Property/Properties, Division, Assigned Agent, Relationship Status (prospecting/active mandate/terminated).
- **Filters:** division, mandate status. BD Agents see this filtered server-side to their assigned landlords by default.
- **Row action:** opens the Landlord Drawer: contact details, properties, mandate summary (read-only, cross-linking to Finance for the financial detail), relationship history, Activity Log including any reassignment events (Section 6.1).
- **Modal — New Landlord:** contact info, properties offered, division, assigned agent.

#### Mandate Status

- **Columns:** Landlord, Property, Mandate Rate (read-only), Status (draft/pending_approval/active/terminated), Monthly Collectible Estimate.
- This tab is intentionally a read-mostly mirror of Finance's Mandates module (Finance spec 7.3), scoped to this division, with one BD-side action available: **"Draft Mandate Letter"**, which routes to Liaison & Requests (8.3) rather than creating the mandate record directly, since mandate activation itself is Finance's action once Front Office formalizes the letter (master spec 4.3).
- Clicking a row opens the same Mandate Detail used in Finance (cross-linked, not duplicated), so BD always sees the current authoritative state rather than a copy that could go stale.

#### Prospecting

- Landlords in active conversation before any mandate exists: stage (Initial Contact / Proposal Sent / Negotiating / Mandate Drafted), next action date, notes.
- **Modal — New Prospecting Record.**
- A prospecting record converts into the Mandate Status tab automatically once a mandate letter draft request is submitted (8.3), rather than requiring the data to be re-entered.

---

### 8.2 Listings & Funnel (`/admin/business-development/listings`)

**Tabs:** Active Listings · Sales Funnel · Closed

#### Active Listings (default)

- **Columns:** Property/Unit, Type (sale/lease/letting), List Price, Days Listed, Assigned Agent.
- Reuses the base CRM's existing `properties`/`units` data rather than maintaining a parallel listings table; this tab is a curated, BD-relevant view over that existing data, scoped to listings actively being marketed.

#### Sales Funnel

- **Kanban board** (Section 2): columns Lead → Viewing → Offer → Negotiation → Closed, cards showing lead name, property, value, assigned agent, days in current stage.
- Drag-and-drop (or an equivalent explicit "Move to next stage" action for accessibility) moves a card between columns, which is a stage-change event, not a record recreation.
- **Drawer (on card click):** full deal detail, contact info, viewing history, offer history, notes, Activity Log.
- **Modal — New Lead.**

#### Closed

- **Columns:** Property, Final Value, Type, Outcome (won/lost), Agent, Date Closed.
- **Modal triggered from a funnel card moved to "Closed":** final deal value, deal type, outcome. On "Closed Won," this submits the commission claim to Finance per Section 6.4, BD does not see or set a commission amount in this modal at all, only the inputs Finance's fee engine needs.

**Downstream coordination:** a closed-won deal's commission charge appears on Finance's Service Fees > Charges Log (Finance spec 7.7), linked back to this deal record.

---

### 8.3 Petty Cash (`/admin/business-development/petty-cash`)

**Tabs:** Float · Expenses · Reconciliation

#### Float (default)

- One row per property/mandate float the viewer has access to: Property/Mandate, Current Balance (derived, Section 6.3), Last Top-Up, Status (healthy/low/depleted).
- **Row action — "Request Top-Up":** Modal, amount requested, justification. Routes through the Approval Engine; small top-ups may auto-approve, larger ones require GM per a configurable threshold, the same pattern as every other threshold-gated action in this ERP (master spec 4.7).

#### Expenses

- **Columns:** Date, Category, Amount, Logged By, Approval Status (auto_approved / pending_gm / approved / rejected), mirroring Finance's Mandate Expenses log (Finance spec 7.3) exactly, since this is the same underlying data viewed from the originating side.
- **Modal — Log Expense:** property/mandate, category, amount, period, optional receipt upload. Submitting does not state whether it'll be auto-approved; that's determined server-side against the threshold and reflected in the resulting status, BD doesn't pre-judge the outcome in the UI.

#### Reconciliation

- A periodic (typically monthly) joint Line Manager and Finance confirmation that logged expenses match actual float depletion: opening balance, top-ups, expenses logged, expected closing balance, actual cash counted, variance.
- **Action — "Submit Reconciliation":** Line Manager confirms the count; a variance beyond a small tolerance flags the period for Finance review rather than silently closing it out.

---

### 8.4 Liaison & Requests (`/admin/business-development/liaison`)

**Tabs:** Vehicle Requests · Mandate Letters · Paperwork

The page that exists specifically to enforce Section 6.2. Every row on every tab carries the same status vocabulary (Requested → In Progress → Awaiting Approval → Completed/Declined), regardless of which department is currently holding it.

#### Vehicle Requests (default)

- **Columns:** Purpose, Date, Destination, Requested By, Status.
- **Modal — New Vehicle Request:** purpose, date, destination, requested vehicle type. Submission and fulfillment both happen against Front Office's logistics records (Front Office spec, master spec 8.1); this page reads that status, it doesn't maintain a second copy of the assignment.
- Status detail on click: if `Awaiting Approval`, shows whether it's waiting on Front Office capacity or a GM sign-off for external hire (master spec 4.1), so "awaiting approval" never reads as a dead end without explanation.

#### Mandate Letters

- **Columns:** Landlord, Property, Status, Current Holder (Front Office formalizing / GM reviewing / CEO reviewing / Active).
- Originates from a Prospecting record (8.1) or directly here. Status changes as Front Office formalizes the letter and as it moves through the approval chain (master spec 4.3), each step visible without BD needing to ask Front Office or Finance directly.
- On reaching `Completed`, the corresponding landlord's Mandate Status (8.1) flips from draft to active automatically.

#### Paperwork

- Application forms and offer letters BD has submitted for Front Office processing (master spec 8.4), same status vocabulary, same transparency principle.

---

### 8.5 Agent KPIs & Goals (`/admin/business-development/kpis`)

**Tabs:** Team Performance (Line Manager view) · My Performance (Agent view) · Time Logs

#### Team Performance (default, Line Manager only)

- **Table:** Agent, Deals Closed (period), Pipeline Value, Conversion Rate, Avg Time to Close, Goal Progress.
- **Modal — Set Agent Goal:** target deals, target pipeline value, target conversion rate, period. Line Manager only, per Section 7.

#### My Performance (Agent view, self-scoped)

- Same metric set as Team Performance, scoped to the logged-in agent, rendered with a progress visual (gauge or bar) against the goal their Line Manager set, rather than a bare number with no context for whether it's good.

#### Time Logs

- Reads HR's `time_logs` table (master spec 6.6), filtered to `log_type = field` and this division's agents. This tab does not maintain a second time-tracking table; it's the same data the HR dashboard's Time & Attendance > Field Logs tab shows (HR spec 8.3), filtered for a BD audience. This mirrors the reuse principle already established in the HR spec itself.

---

## 9. Escalation & Request Tracking UX

Shorter than the equivalent Finance and HR sections, because BD rarely decides anything; it mostly originates and tracks. The one place a Line Manager genuinely decides something inside BD's own module is reconciliation sign-off (8.3) and goal-setting (8.5), neither of which is an approval gate in the Finance/HR sense.

### 9.1 What BD Sees While Waiting

Every liaison item, mandate, and top-up request BD originates surfaces its current status using the vocabulary in Section 6.2, on the page it was created from (8.1, 8.3, 8.4) and, where it involves a GM/CEO decision, in the Unified Approvals Queue (master spec 9.2) as well, the same dual-surface principle established in Finance and HR, just asymmetric here: BD only ever sees the inline status, never an inline Approve/Reject control of its own, since the deciding party is always another department.

### 9.2 What Happens on Decision (elsewhere)

When Finance or Front Office decides something BD originated, approves a mandate, declines a vehicle request, the relevant `private-bd-*` Pusher event (Section 5.3) updates BD's view immediately, and a toast notifies the original requester by name, not just a generic "an approval was decided" message. A decline always carries the decision notes through to BD's view, the same required-notes rule used everywhere else in the ERP for rejections.

---

## 10. Cross-Department Coordination Matrix

Bidirectional, since BD both sends requests outward and receives escalations inward more than any other module in this ERP.

| Direction | Trigger | Department | Result |
|---|---|---|---|
| BD → Front Office | Vehicle request submitted | Front Office | Appears on Front Office logistics queue (Front Office spec) |
| BD → Front Office | Mandate letter draft requested | Front Office | Appears on Front Office paperwork queue |
| BD → Finance | Mandate letter formalized, ready for activation | Finance | Mandate moves to pending_approval on Finance's Mandates page |
| BD → Finance | Petty cash expense logged | Finance | Appears on the mandate's Expenses Log, auto-approved or pending_gm |
| BD → Finance | Deal closed won | Finance | Commission charge created on Service Fees > Charges Log |
| Finance → BD | Defaulter or vacancy escalated | Business Development | Appears on Overview's incoming Alerts Panel and the relevant landlord's Drawer |
| Finance → BD | Mandate expense approved/rejected | Business Development | Petty Cash > Expenses status updates, toast to the original logger |
| HR → BD | Field time log recorded | Business Development | Reflected read-only on Agent KPIs > Time Logs |

---

## 11. Redirect & Navigation Rules

| After this action | User lands here | What they see |
|---|---|---|
| Add new landlord | Landlords > Directory | New row appears, drawer opens automatically to confirm details |
| Move funnel card to Closed Won | Stays on Sales Funnel | Card disappears from board, toast links to the new row on Closed tab |
| Submit vehicle request | Stays on Liaison > Vehicle Requests | New row at `Requested`, toast confirms submission |
| Log petty cash expense | Stays on Petty Cash > Expenses | New row appears with its resulting status, toast states auto-approved or pending |
| Submit reconciliation | Stays on Petty Cash > Reconciliation | Period marked submitted, variance (if any) flagged for Finance |
| Mandate letter reaches Completed | No redirect (background event) | Landlords > Mandate Status updates from draft to active, toast notifies the original requester |
| Set agent goal | Stays on Team Performance | Goal appears against that agent's row immediately |

---

## 12. Notification & Badge System

Same mechanics as Finance Section 11 and HR Section 12: sidebar group and sub-link badges reflect pending/attention counts, severity colored amber/rose, no separate notification center. Liaison & Requests carries the most active badge in this module, by design, since its entire purpose is keeping BD aware of state changes happening in departments it doesn't control.

---

## 13. Component Inventory

| Component | Used on |
|---|---|
| `BDOverviewBoard`, `BDAlertsPanel` (bidirectional), `BDActivityFeed` | 8.0 |
| `PipelineByStageChart` (shared chart component, new dataset) | 8.0 |
| `LandlordDirectoryTable`, `LandlordDrawer` | 8.1 |
| `MandateStatusTable` (read-mostly mirror of Finance's mandate data) | 8.1 |
| `ProspectingTable`, `NewLandlordModal`, `NewProspectingModal` | 8.1 |
| `ActiveListingsTable`, `SalesFunnelBoard` (Kanban variant), `DealDrawer` | 8.2 |
| `NewLeadModal`, `CloseDealModal` | 8.2 |
| `PettyCashFloatTable`, `TopUpRequestModal` | 8.3 |
| `PettyCashExpensesTable`, `LogExpenseModal` | 8.3 |
| `ReconciliationPanel` | 8.3 |
| `VehicleRequestsTable`, `NewVehicleRequestModal` | 8.4 |
| `MandateLettersTable`, `PaperworkTable` | 8.4 |
| `TeamPerformanceTable`, `SetGoalModal` | 8.5 |
| `MyPerformancePanel` (gauge/progress visual) | 8.5 |
| `FieldTimeLogsTable` (reused from HR, filtered view) | 8.5 |
| `LiaisonStatusBadge` (the shared status-vocabulary component, Section 6.2) | 8.3, 8.4 |
| `SidebarGroupBadge` (shared with Finance, HR) | Section 3.1, 12 |

---

## 14. Performance & Caching Summary

Covered in full in Section 5.4. Overview, Team Performance, and Pipeline Value are cached, the views that aggregate across many records. Liaison & Requests is explicitly never cached (Section 5.4), since a stale status is the one failure mode that would defeat this page's entire purpose.

---

## 15. BD-Specific Verification Checklist

In addition to the generic checklist in the master spec (Section 12):

- [ ] Every Liaison & Requests row shows a status from the standard vocabulary (Section 6.2), never a department-specific status term leaking through unexplained.
- [ ] Petty cash float balance is confirmed derived from `mandate_expenses`, not an independently editable field anywhere in the BD codebase.
- [ ] The Close Deal modal never displays or accepts a commission amount; only deal value, type, and agent are submitted.
- [ ] Mandate rate is read-only everywhere in BD; the only edit path is Finance Head, in Finance.
- [ ] BD Agents see only assigned records; Line Managers see their full division; reassignment is logged.
- [ ] A declined liaison request always carries the decision notes through to BD's view.
- [ ] Mandate Status tab reads live from Finance's mandate record rather than a BD-side copy.

---

## 16. Build Sequence for This Module

A finer-grained breakdown of master spec Phase 7, specific to Business Development, sequenced to depend on Front Office (Phase 6) and Finance's Mandates module (Phase 2) already existing.

1. Territory and ownership model (Section 6.1) plus Landlords > Directory, the foundation every other page links back to.
2. Listings & Funnel, BD's daily-driver page and the one with the most standalone value, shipped early even before every cross-department integration is finished.
3. Liaison & Requests, once Front Office's logistics and paperwork queues exist to read status from.
4. Petty Cash, once Finance's mandate expense approval flow (Finance spec 7.3) is live to read approval status from.
5. Mandate Status tab on Landlords, wiring the read-mostly mirror into Finance's live mandate data.
6. Agent KPIs & Goals, last among the department-specific pages, since Team Performance and conversion-rate metrics are only meaningful once Listings & Funnel has real deal history and HR's Time Logs (HR spec build step 2) already exist to read from.
7. Overview, last overall, as a rollup of both BD's outgoing requests and Finance's incoming escalations, each of which needs to already exist before Overview can meaningfully summarize them.
