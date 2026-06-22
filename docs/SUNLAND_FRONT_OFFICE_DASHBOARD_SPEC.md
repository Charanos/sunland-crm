# Sunland Front Office Dashboard — Comprehensive Functional Spec

**Document status:** Drill-down of `SUNLAND_ERP_IMPLEMENTATION_SPEC.md` Section 8, expanded to the depth required to build Front Office as its own near-standalone logistics and office administration system inside the ERP shell, matching the rigor of `SUNLAND_FINANCE_DASHBOARD_SPEC.md`, `SUNLAND_HR_DASHBOARD_SPEC.md`, and `SUNLAND_BD_DASHBOARD_SPEC.md`.
**Relationship to other documents:** Inherits the design system, entity context, locked components, and RBAC role list without modification. Where Finance's challenge was financial-logic integrity, HR's was access control, and BD's was territory ownership plus request transparency, Front Office's is the mirror image of BD's: it's the **execution layer** other departments depend on. BD's Liaison & Requests page (BD spec 8.4) is only as good as Front Office's discipline in keeping the underlying status current. This document is, in large part, the resolution of every "Front Office will handle this" reference left open in the Finance, HR, and BD specs.

---

## 0. How to Use This Document

Read Section 6 before any page in Section 8. It resolves three things the earlier three documents deliberately left open rather than guessed at: the internal-to-external status mapping BD's Liaison page depends on, the decision to build Appointments as a single shared, polymorphic scheduling primitive instead of three separate calendars, and how driver assignability reads HR's credential data without duplicating it. Section 9 closes the loop on BD's "what happens while waiting" question from the execution side.

---

## 1. Open Threads From Earlier Documents, Resolved Here

| Open question | Where it was raised | Resolution |
|---|---|---|
| Should Interview Scheduling reuse Front Office's Appointments component? | HR spec 8.4 | Yes. Section 6.2 specifies the shared schema. |
| Should BD's viewing scheduling reuse the same component? | BD spec, implied by 8.2 | Yes, same schema, same answer. |
| How does Front Office know a driver's license is valid without duplicating HR's data? | HR spec 10 (downstream coordination) | Section 6.3: read live from HR Credentials, never copied. |
| What does "Awaiting Approval" actually mean operationally, from BD's side? | BD spec 6.2 | Section 6.1: the internal-to-external status mapping table. |
| Are BD's mandate letter tracking and Front Office's mandate letter processing the same record? | BD spec 8.4 | Yes, one record, two views. Section 8.4 states this explicitly. |

---

## 2. Design Foundation (Carried Over, Not Restated in Full)

Same as the three prior specs: Board layout, Modal/Drawer/Confirm Dialog/Toast systems, `formatCompactKES()`, `title-serif`/`font-mono`, the five-tone semantic palette. No new visual primitive. The one layout pattern Front Office uses more heavily than any prior module is the **calendar view** (Section 8.2), specified as a variant of the existing data tier the same way BD's Kanban funnel was, not a new component family.

---

## 3. Information Architecture: Sidebar Grouping & Tab Navigation

### 3.1 Sidebar Group

```
Front Office                                [●5]
 ├─ Overview
 ├─ Logistics                                [●3]
 ├─ Appointments
 ├─ Petty Cash                               [●1]
 └─ Paperwork                                [●1]
```

### 3.2 Tab Strip Within a Section

Same mechanism as every prior spec: route-based tabs, Brand Dark active state, page-level KPI tier shared across a section where the data describes the whole section.

### 3.3 Full Route Map for This Module

```
/admin/front-office                                              Overview
/admin/front-office/logistics/vehicle-requests                   Logistics (default tab)
/admin/front-office/logistics/fleet-drivers
/admin/front-office/logistics/trip-logs
/admin/front-office/appointments/calendar                        Appointments (default tab)
/admin/front-office/appointments/upcoming
/admin/front-office/appointments/by-module
/admin/front-office/petty-cash/float                              Petty Cash (default tab)
/admin/front-office/petty-cash/expenses
/admin/front-office/petty-cash/reconciliation
/admin/front-office/paperwork/applications                        Paperwork (default tab)
/admin/front-office/paperwork/offer-letters
/admin/front-office/paperwork/mandate-letters
```

---

## 4. Global Front Office Shell

Same shape as the prior three specs: persistent entity context, breadcrumb (`Front Office / [Section] / [Tab]`), section-scoped search (requester names, vehicle registrations, applicant names, appointment titles). One Front Office-specific addition: a **"Today" strip** pinned at the top of Overview, distinct from anything in Finance, HR, or BD, since Front Office's work is the most time-of-day sensitive in the ERP, vehicles go out and come back today, appointments happen today, and a department whose job is largely "what's happening right now" needed that reflected structurally, not just as one KPI card among several period-based ones.

---

## 5. State, Data & Real-Time Architecture

### 5.1 Client State (Zustand)

```
useFrontOfficeStore
  activeRequestDrawerId: string | null
  activeAppointmentDrawerId: string | null
  activePaperworkDrawerId: string | null
  logisticsFilters: { status, dateRange }
  appointmentFilters: { type, linkedModule, dateRange }
```

### 5.2 Server State (TanStack Query)

```
['fo', 'overview', entityId]
['fo', 'logistics', tab, entityId, filters]
['fo', 'vehicle-request', requestId]
['fo', 'appointments', tab, entityId, filters]
['fo', 'petty-cash', tab, entityId]
['fo', 'paperwork', tab, entityId, filters]
['fo', 'mandate-letter', letterId]
```

`mandate-letter` is queried by a shared key structure deliberately close to BD's own query keys for the same record (BD spec 5.2), since, per Section 1, this is one record viewed from two sides, not two records.

### 5.3 Real-Time (Pusher)

| Channel | Events | Triggers |
|---|---|---|
| `private-fo-logistics` | `vehicle-request.triaged`, `vehicle-request.assigned`, `vehicle-request.escalated`, `vehicle-request.declined` | Invalidates Logistics queries, fires the matching `private-bd-liaison` event (BD spec 5.3) so the requester's view updates without polling |
| `private-fo-appointments` | `appointment.created`, `appointment.rescheduled`, `appointment.cancelled` | Invalidates Appointments queries; if `linked_module` is set, also notifies the originating module's channel |
| `private-fo-petty-cash` | `expense.logged`, `topup.requested`, `topup.decided` | Invalidates Petty Cash queries |
| `private-fo-paperwork` | `application.processed`, `offer-letter.status-changed`, `mandate-letter.status-changed` | Invalidates Paperwork queries, mandate letter events also fire BD's corresponding channel |

The cross-channel notification on `vehicle-request.*` and `mandate-letter.*` events is the literal implementation of BD's "no black box" principle (BD spec 6.2): Front Office isn't just updating its own queue, it's actively pushing the status change to the requester's module the moment it happens.

### 5.4 Caching (Upstash Redis)

| Cache key | TTL | Invalidated by |
|---|---|---|
| `fo:overview:{entityId}` | 3 min | Shorter than Finance/HR/BD's Overview TTLs, since "what's happening today" goes stale faster than a financial aggregate does |
| `fo:fleet-availability:{entityId}` | 2 min | `vehicle-request.assigned`, trip start/end events |
| `fo:appointments-today:{entityId}` | 5 min | `appointment.created`, `appointment.cancelled` |

Logistics' Vehicle Requests tab and Paperwork's Mandate Letters tab are never cached, for the same reason BD's Liaison page isn't (BD spec 5.4): these are exactly the views where staleness is most visible and most costly to the department waiting on them.

---

## 6. Fulfillment Discipline & Shared Service Design

Front Office's cross-cutting design principles, read before any page below.

### 6.1 Internal Triage States vs. the External Status Vocabulary

BD's Liaison & Requests page (BD spec 6.2) shows requesters a simple, standardized vocabulary: Requested → In Progress → Awaiting Approval → Completed/Declined. Front Office's own working queue needs more operational granularity than that to actually run the desk. This table is the mapping between the two, and it is the single most important piece of plumbing connecting this document to the BD spec:

| Front Office internal state | External status shown to requester |
|---|---|
| Received | Requested |
| Checking Availability | In Progress |
| Assigned / Confirmed | Completed |
| Escalated for GM/CEO Approval | Awaiting Approval |
| Declined / Unavailable | Declined |

Front Office staff work in the left column. Every other department sees only the right column. A developer adding a new internal state later must map it into one of the four external buckets before shipping it, never let a new internal-only label leak through to a requester's screen unexplained, since that's precisely the failure mode BD's spec was written to prevent.

### 6.2 Appointments as a Shared, Polymorphic Service

Resolving the question both HR and BD raised and deferred: Appointments is built once, generically, and reused, not forked per department.

```
appointments
  id, entity_id, appointment_type (viewing | interview | internal_meeting | client_meeting | other),
  linked_module (nullable: 'hr_recruitment' | 'bd_listings' | 'executive' | null),
  linked_record_id (nullable, polymorphic reference to the originating record),
  title, start_time, end_time, location,
  attendees (array of user_ids), created_by
```

HR's Interview Schedule (HR spec 8.4) and BD's viewing scheduling (BD spec 8.2) both create rows here with `linked_module` set, rather than maintaining their own calendar tables. Front Office's Appointments page is the canonical surface for all of it; HR and BD's own pages show a filtered view of the same underlying data (By Linked Module, Section 8.2), the identical reuse pattern already established for time logs (HR owns them, BD reads a filtered view) and mandate financials (Finance owns them, BD reads a filtered view).

### 6.3 Reading, Not Duplicating, Credential Data

Driver assignability (Section 8.1) checks HR's `employee_credentials` table live, specifically whether a Driver-role employee's license is current, rather than maintaining a second copy of license status inside Front Office. An expired license simply removes that driver from the assignable pool in the Assign Vehicle & Driver modal; Front Office never edits or stores the credential itself, that stays HR's record (HR spec 8.6), Front Office only ever reads it.

### 6.4 Office Petty Cash Is Not Property Petty Cash

Office Petty Cash (Section 8.3) is a distinct float from BD's property/mandate-level petty cash (BD spec 8.3): different owner, different threshold (KES 10,000 vs. BD's KES 5,000, per master spec 4.7), different purpose, day-to-day office running costs rather than property-specific repair and site expenses. The two pages can share the same underlying component (`PettyCashFloatTable`, parameterized by scope) without ever sharing the same float record. This is stated explicitly because the two pages will look near-identical, and that resemblance should not be mistaken for the data being the same.

---

## 7. Front-Office-Specific Permissions Matrix

| Action | Front Office Head | Front Office Admin | Driver | GM | CEO |
|---|---|---|---|---|---|
| View vehicle requests / fleet | Yes | Yes | Own assignments only | Yes | Yes |
| Assign vehicle & driver | Yes | Yes | No | View | View |
| Escalate vehicle request to GM | Yes | Yes | No | Approve | Approve |
| Add/edit vehicle or driver record | Yes | No | No | View | View |
| Log trip | Yes | Yes | Yes (own trips) | View | View |
| Manage appointments (any linked module) | Yes | Yes | No | View | View |
| Log office petty cash expense | Yes | Yes | No | View | View |
| Request office petty cash top-up | Yes | No | No | Approve per threshold | Approve per threshold |
| Process application forms | Yes | Yes | No | View | View |
| Generate offer letter | Yes | Yes | No | View | View |
| Formalize mandate letter | Yes | Yes | No | Approve if escalated | Approve if escalated |

---

## 8. Page-by-Page Functional Specification

### 8.0 Overview (`/admin/front-office`)

Built last (Section 16), as with every other module, but with the "Today" strip (Section 4) as its defining structural difference from Finance, HR, and BD's overviews.

**Today Strip** (pinned above the KPI tier): vehicles out today, appointments today, paperwork due today, at-a-glance, refreshed on the 2–5 minute cache windows in Section 5.4.

**KPI Tier**

| Card | Formula | Notes |
|---|---|---|
| Open Vehicle Requests | `COUNT` not yet Completed/Declined | Links to Logistics |
| Fleet Availability | `COUNT(vehicles, status=available) / COUNT(vehicles total)` | |
| Appointments Today | `COUNT(appointments)` where date = today | Links to Appointments > Calendar |
| Pending Paperwork | `COUNT` across application forms, offer letters, mandate letters not yet Completed | Links to Paperwork |
| Office Petty Cash Status | Floats below threshold, count | Links to Petty Cash > Float |
| SLA Breaches | `COUNT` of any request past its handling window across Logistics and Paperwork | Rose-toned if non-zero |

**Alerts Panel:** vehicle requests awaiting GM approval, drivers with expired licenses (read from HR, Section 6.3), mandate letters stalled, double-booked appointment conflicts flagged but unresolved (Section 8.2).

**Data Tier:** Recent Activity feed (request triage decisions, vehicle assignments, paperwork completions); a compact Today's Schedule view combining vehicle trips and appointments happening today in one timeline, the one place in this module where logistics and appointments data are shown together rather than on separate pages.

---

### 8.1 Logistics (`/admin/front-office/logistics`)

**Tabs:** Vehicle Requests · Fleet & Drivers · Trip Logs

#### Vehicle Requests (default)

- **Columns:** Requested By, Purpose, Date, Destination, Internal State, External Status (Section 6.1, shown for staff reference even though it's the requester-facing label).
- **Row action — "Check Availability":** opens a fleet calendar for the requested date.
- **Row action — "Assign Vehicle & Driver":** Modal, vehicle selector (filtered to available status), driver selector (filtered to those with a current license per Section 6.3). On confirm, internal state moves to Assigned/Confirmed, external status flips to Completed, and the cross-channel event (Section 5.3) notifies BD immediately.
- **Row action — "Escalate to GM":** used when no vehicle is available or external hire is implied (master spec 4.1). Writes an `approval_requests` row, internal state moves to Escalated, external status shows Awaiting Approval.
- **Drawer:** full request detail, assignment history, Activity Log.

#### Fleet & Drivers

- **Vehicles sub-table:** registration, make/model, capacity, status (available/in-use/maintenance/out-of-service). **Row action — "Mark for Maintenance":** routes the vehicle into the existing Operations & Maintenance module's ticketing system (Operations spec) rather than building a second maintenance tracker here, reusing infrastructure that already exists instead of duplicating it.
- **Drivers sub-table:** employee (linked to HR's employee record, not re-created here), license status (read-only, from HR), current assignment, availability. **Adding a driver links an existing HR employee with the Driver role**; it does not create a new employee record, that stays HR's flow (HR spec 8.1).
- **Modal — Add Vehicle.**

#### Trip Logs

- **Columns:** Vehicle, Driver, Date, Destination, Mileage, Fuel Cost, Linked Vehicle Request.
- **Modal — Log Trip.** Fuel and mileage costs post to Finance's Accounts Payable as an office operating expense (Finance spec 7.5) rather than sitting as an isolated, financially invisible log entry, the same "every cost eventually surfaces to Finance" principle that governs petty cash everywhere else in this ERP.

---

### 8.2 Appointments (`/admin/front-office/appointments`)

**Tabs:** Calendar · Upcoming · By Linked Module

#### Calendar (default)

- Day/week/month toggle, color-coded by `appointment_type` using opacity variants of the Brand Dark token, the same color-economy choice made for HR's leave calendar (HR spec 8.2), rather than introducing new hues per type.
- **Conflict detection:** a new appointment overlapping an existing one for the same attendee, property, or resource shows a soft warning before save, not a hard block, since legitimate near-overlaps happen (an agent finishing one viewing as another starts) and shouldn't be prevented outright.
- **Modal — New Appointment:** type, title, time, location, attendees, optional `linked_module`/`linked_record_id`, pre-filled automatically when created from within HR's Interview Schedule or BD's listing flow rather than chosen manually in those contexts.
- **Drawer:** detail, attendee list, reschedule/cancel actions, Activity Log.

#### Upcoming

- List view, next 7/14/30 days, filterable by type, linked module, attendee.

#### By Linked Module

- A breakdown of appointment volume by originating module (HR interviews, BD viewings, Executive meetings, general), useful for Front Office capacity planning, and the clearest visual evidence that Section 6.2's shared-service decision is actually paying off rather than just being an architectural claim.

---

### 8.3 Petty Cash (`/admin/front-office/petty-cash`)

**Tabs:** Float · Expenses · Reconciliation

Structurally identical to BD's Petty Cash pages (BD spec 8.3), same component family per Section 6.4, scoped to the office float instead of property/mandate floats, with the office threshold (KES 10,000) instead of BD's property threshold (KES 5,000).

- **Float:** current balance (derived from logged expenses and top-ups, never an independently edited number, the same rule as BD's float), status (healthy/low/depleted).
- **Expenses:** date, category, amount, logged by, approval status, auto-approved or pending GM per the office threshold.
- **Reconciliation:** periodic joint Front Office Head and Finance confirmation, opening balance, top-ups, expenses, expected vs. counted closing balance, variance flagged for Finance review if beyond tolerance.

---

### 8.4 Paperwork (`/admin/front-office/paperwork`)

**Tabs:** Application Forms · Offer Letters · Mandate Letters

#### Application Forms (default)

- **Columns:** Applicant Name, Type (tenant/landlord), Property, Status (Received/Under Review/Processed), Submitted By.
- **Modal — New Application Form:** digitized intake fields mirroring the physical form.
- **Drawer:** full detail, document preview/upload, processing actions.

#### Offer Letters

- Generated from existing data, property, applicant, and terms pulled from the relevant listing or closed deal (BD spec 8.2) rather than re-typed. Status: Drafted → Sent → Signed/Returned → Filed.
- **Signature capture** is a placeholder for an uploaded signed scan in this version of the spec; whether a future e-signature integration replaces that is flagged here as an undecided infrastructure choice, not assumed one way or the other.

#### Mandate Letters

This is the execution side of the workflow BD initiates on its own Liaison & Requests page (BD spec 8.4). Per Section 1, **this is the same underlying record BD tracks, not a separate copy**: BD's view is the originator's tracking view, this is the executor's working view.

- **Columns:** Landlord, Property, Status (Draft Received → Formalizing → Sent for Approval → Signed/Active).
- **Row action — "Formalize":** Front Office drafts the actual letter document from BD's submitted terms summary plus existing landlord/property data. On completion, the record routes into the Approval Engine per master spec 4.3, the same threshold-gated pattern used everywhere else in this ERP, and status changes are visible back on BD's Liaison page in real time (Section 5.3).
- **On reaching Signed/Active:** Finance's Mandates module (Finance spec 7.3) activates the mandate record, and BD's Landlords > Mandate Status tab (BD spec 8.1) flips from draft to active automatically, closing the loop that started as a prospecting conversation in BD.

---

## 9. Fulfillment UX: Closing the Loop BD Opened

This section is the execution-side counterpart to BD spec Section 9 ("Escalation & Request Tracking UX"), which described what a requester sees while waiting. This section describes what Front Office does to make that waiting accurate and short.

### 9.1 Triage Discipline

Every incoming request lands at the internal state "Received" and is expected to move to either "Checking Availability" or directly to a decision within a configurable handling window (the SLA referenced throughout this document). A request sitting at "Received" past that window is what populates the SLA Breaches KPI card (8.0) and the corresponding sidebar badge severity (Section 12), the operational definition of "Front Office is falling behind," made visible rather than left as a vague sense that requests are taking a while.

### 9.2 What Happens on Decision

- **Assigned/Confirmed:** fires the cross-channel event (5.3) immediately, the requester's BD or HR view updates without any manual follow-up message needed.
- **Escalated:** writes the `approval_requests` row, GM/CEO decide through the same Confirm Dialog and required-rejection-notes pattern used identically across Finance, HR, and BD; Front Office is notified the moment a decision lands, the same as any other requester would be.
- **Declined:** requires a reason, surfaced to the requester's view exactly as written, never summarized into a generic "declined" with the actual reason buried in a drawer only Front Office can see.

---

## 10. Cross-Department Coordination Matrix

| Direction | Trigger | Department | Result |
|---|---|---|---|
| BD → Front Office | Vehicle request submitted | Front Office | Lands in Logistics > Vehicle Requests at "Received" |
| BD → Front Office | Mandate letter draft requested | Front Office | Lands in Paperwork > Mandate Letters |
| Front Office → BD | Vehicle assigned, declined, or escalated | Business Development | BD's Liaison page updates via cross-channel event |
| Front Office → BD | Mandate letter reaches Signed/Active | Business Development, Finance | BD's Mandate Status flips to active; Finance activates the mandate record |
| Front Office → Finance | Trip mileage/fuel logged | Finance | Posts as an Accounts Payable office expense |
| Front Office → Finance | Office petty cash reconciliation variance | Finance | Flagged for Finance review, same pattern as BD's property petty cash |
| HR → Front Office | Driver credential expires | Front Office | Driver removed from the assignable pool in Assign Vehicle & Driver |
| HR → Front Office | Interview scheduled | Front Office | Appears on the shared Appointments calendar with `linked_module = hr_recruitment` |
| BD → Front Office | Viewing scheduled | Front Office | Appears on the shared Appointments calendar with `linked_module = bd_listings` |
| Executive → Front Office | Internal meeting scheduled | Front Office | Appears on the shared Appointments calendar with `linked_module = executive` |

---

## 11. Redirect & Navigation Rules

| After this action | User lands here | What they see |
|---|---|---|
| Assign vehicle & driver | Stays on Vehicle Requests | Row's external status flips to Completed, toast confirms, cross-channel event fires to BD |
| Escalate vehicle request | Stays on Vehicle Requests | Row shows Awaiting Approval, item appears in Unified Approvals Queue |
| Log trip | Stays on Trip Logs | New row appears, toast confirms AP posting to Finance |
| Create appointment from within HR/BD | Returns to the originating module's page | New appointment appears on Front Office's calendar in the background, no redirect interrupts the originating workflow |
| Formalize mandate letter | Stays on Paperwork > Mandate Letters | Status updates, item enters approval flow if required |
| Mandate letter reaches Signed/Active | No redirect (background event) | BD's Mandate Status and Finance's Mandates both update independently |
| Submit petty cash reconciliation | Stays on Reconciliation | Period marked submitted, variance flagged if applicable |

---

## 12. Notification & Badge System

Same mechanics as every prior spec: sidebar group and sub-link badges, amber for normal pending items, rose for SLA breaches (Section 9.1), no separate notification center. Logistics carries the busiest badge in this module under normal operating conditions, the same way Liaison & Requests carries BD's, because vehicle requests are the highest-volume, most time-sensitive workflow Front Office runs.

---

## 13. Component Inventory

| Component | Used on |
|---|---|
| `FOOverviewBoard`, `TodayStrip`, `FOAlertsPanel`, `FOActivityFeed` | 8.0 |
| `VehicleRequestsTable`, `AssignVehicleDriverModal`, `VehicleRequestDrawer` | 8.1 |
| `FleetTable`, `DriversTable`, `AddVehicleModal` | 8.1 |
| `TripLogsTable`, `LogTripModal` | 8.1 |
| `AppointmentsCalendar` (shared, polymorphic, Section 6.2), `AppointmentDrawer`, `NewAppointmentModal` | 8.2, reused by HR spec 8.4, BD spec 8.2 |
| `PettyCashFloatTable` (shared component, scope-parameterized, Section 6.4) | 8.3, shared with BD spec 8.3 |
| `PettyCashExpensesTable`, `LogExpenseModal`, `ReconciliationPanel` | 8.3 |
| `ApplicationFormsTable`, `NewApplicationModal` | 8.4 |
| `OfferLettersTable`, `GenerateOfferLetterAction` | 8.4 |
| `MandateLettersTable` (same record as BD's, Section 8.4), `FormalizeMandateLetterModal` | 8.4, shared with BD spec 8.4 |
| `SidebarGroupBadge` (shared across all four department docs) | Section 3.1, 12 |

---

## 14. Performance & Caching Summary

Covered in full in Section 5.4. Overview's cache window is shorter than Finance, HR, or BD's, reflecting how quickly "what's happening today" goes stale compared to a financial or pipeline aggregate. Vehicle Requests and Mandate Letters are never cached, for the same reason BD's Liaison page isn't: these are the views where staleness is most visible to a department waiting on Front Office.

---

## 15. Front-Office-Specific Verification Checklist

In addition to the generic checklist in the master spec (Section 12):

- [ ] Every internal triage state maps to exactly one of the four external statuses (Section 6.1); no internal-only label is ever shown to a requester.
- [ ] A `vehicle-request.*` or `mandate-letter.*` state change fires the corresponding cross-channel event to BD in the same action that updates Front Office's own view, not as a separate, easily-forgotten step.
- [ ] Appointments uses the shared, polymorphic schema; confirmed HR's Interview Schedule and BD's viewing scheduling write to this table rather than maintaining their own.
- [ ] Driver assignability reads HR's `employee_credentials` live; no expiry date is duplicated or cached inside Front Office's own tables.
- [ ] Office Petty Cash and BD's property petty cash are confirmed to use distinct float records despite sharing a component.
- [ ] Mandate Letters on this page and on BD's Liaison page are confirmed to be the same underlying record, verified by checking both views update from a single write.
- [ ] Vehicle "Mark for Maintenance" routes into the existing Operations module rather than a new, parallel maintenance tracker.
- [ ] Trip mileage/fuel costs are confirmed to post to Finance's Accounts Payable, not left as a financially invisible log.

---

## 16. Build Sequence for This Module

A finer-grained breakdown of master spec Phase 6, sequenced with explicit awareness of what it unblocks downstream in BD (Phase 7) and HR (Phase 7, Recruitment).

1. Logistics: Fleet & Drivers, then Vehicle Requests intake and assignment. This is the highest-priority piece in the entire module, since BD's Liaison & Requests page (BD spec build step 3) cannot be meaningfully tested without it.
2. Paperwork: Application Forms, then Mandate Letters. Mandate Letters specifically must exist before BD's mandate activation flow (BD spec build step 5) can complete end to end.
3. Appointments, built as the shared, polymorphic schema from the start (Section 6.2) rather than a Front-Office-only calendar, so HR's Recruitment module (HR spec build step 7) and BD's viewing scheduling can adopt it instead of retrofitting onto it later.
4. Office Petty Cash, reusing the `PettyCashFloatTable` component already proven in BD's own build (BD spec build step 4), parameterized for the office scope.
5. Trip Logs and the Finance AP posting integration.
6. Overview, last, as a rollup, with the "Today" strip as the final piece since it depends on Logistics and Appointments both already carrying real, current data.
