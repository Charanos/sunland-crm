# Sunland HR Dashboard — Comprehensive Functional Spec

**Document status:** Drill-down of `SUNLAND_ERP_IMPLEMENTATION_SPEC.md` Section 6, expanded to the depth required to build HR as its own near-standalone Human Resource Management system inside the ERP shell, matching the rigor of `SUNLAND_FINANCE_DASHBOARD_SPEC.md`.
**Relationship to other documents:** Inherits the design system, entity context, and locked components from the master spec without modification. Inherits the RBAC role list from master spec Section 3.2, narrowed here to HR-specific actions (Section 7). Where Finance's challenge was financial-logic integrity, HR's challenge is access control: who is allowed to know what about whom. That distinction shapes this entire document and gets its own section (6) before the page-by-page spec, because every later page assumes it.

---

## 0. How to Use This Document

Read Section 3 for the navigation shape, then Section 6 for the confidentiality model, before touching any page. Section 6 governs Sections 8.7 and 8.8 (Complaints, Medical & Insurance) most heavily, but its principles, absence over restriction, logging access not just edits, apply across the whole module. Section 9 (Escalation) introduces a multi-step approval pattern this module needs that Finance's single-step pattern didn't, covered in full there.

---

## 1. Assumptions Stated Up Front

1. **Tab navigation is route-based**, same convention as Finance (Section 3 below), to be confirmed against the live sidebar/tab components before build.
2. **This document specs the HR admin dashboard, not employee self-service.** Clock-in/out, leave request submission, and viewing one's own payslip are naturally employee-initiated actions. Rather than guess at a self-service surface that hasn't been scoped, this document treats those as a separate, lighter-weight component reusing the same backend tables, and specs only the admin-side review and management of that data. Where a page below would otherwise feel incomplete without the self-service half, that gap is named explicitly rather than papered over.
3. **The shared Approval Engine (master spec 3.3) needs a small extension for HR.** Finance's approvals are single-decider: one GM or CEO action resolves the request. Promotions and demotions (Section 8.5) require a sequence of named parties to act in order. Rather than bolt sequential logic onto `approval_requests` as special-case fields, this document proposes a child table, `approval_steps`, so any future module needing multi-party sign-off (not just HR) can use the same mechanism. This is flagged as a schema extension to confirm with whoever owns the Approval Engine before building Section 8.5, not as something already decided unilaterally here.
4. **One new route is added beyond the master spec's HR list**, `/admin/hr/payroll-liaison`, to give master spec Section 6.7 ("Finance-Facing Reports") a real home instead of being an implied sub-feature of Payroll without a page. Reasoning is in Section 8.9.

---

## 2. Design Foundation (Carried Over, Not Restated in Full)

Same as Finance Section 2: Board layout, Modal/Drawer/Confirm Dialog/Toast systems, `formatCompactKES()` where money appears (statutory remittance figures, salary band changes), `title-serif`/`font-mono`, the five-tone semantic palette including amber for awaiting-approval. No new visual primitive is introduced for HR. Where Finance needed a Statement layout for financial documents, HR needs nothing equivalent; every HR page fits the existing Board and Drawer patterns.

---

## 3. Information Architecture: Sidebar Grouping & Tab Navigation

### 3.1 Sidebar Group

```
HR                                          [●7]
 ├─ Overview
 ├─ Employees
 ├─ Leave                                   [●4]
 ├─ Time & Attendance                       [●2]
 ├─ Recruitment
 ├─ Career Changes                          [●1]
 ├─ Credentials                             [●3]
 ├─ Medical & Insurance                     *hidden for unauthorized roles, see Section 6*
 ├─ Complaints                              [●1] *visible only to HR Head, GM, CEO*
 └─ Payroll Liaison
```

Two sub-links, Medical & Insurance and Complaints, are not just badge-hidden but **absent from the rendered sidebar entirely** for any role without access, per Section 6. A Line Manager does not see a greyed-out "Complaints" link; they see a sidebar with nine items, not ten, because the tenth was never rendered for them.

### 3.2 Tab Strip Within a Section

Same mechanism as Finance Section 3.2: route-based tabs, Brand Dark active state, page-level KPI tier shared across a section's tabs where the data describes the whole section, tab-scoped where it describes a slice of it.

### 3.3 Full Route Map for This Module

```
/admin/hr                                                Overview
/admin/hr/employees/directory                            Employees (default tab)
/admin/hr/employees/org-structure
/admin/hr/employees/records
/admin/hr/employees/[id]                                 Employee full profile (edge case, see 8.1)
/admin/hr/leave/requests                                 Leave (default tab)
/admin/hr/leave/balances
/admin/hr/leave/calendar
/admin/hr/time-tracking/office                           Time & Attendance (default tab)
/admin/hr/time-tracking/field
/admin/hr/time-tracking/timesheets
/admin/hr/time-tracking/anomalies
/admin/hr/interviews/candidates                          Recruitment (default tab)
/admin/hr/interviews/schedule
/admin/hr/interviews/outcomes
/admin/hr/promotions/proposed                            Career Changes (default tab)
/admin/hr/promotions/pending-approval
/admin/hr/promotions/approved
/admin/hr/promotions/declined
/admin/hr/credentials/active                             Credentials (default tab)
/admin/hr/credentials/expiring
/admin/hr/credentials/expired
/admin/hr/medical/records                                Medical & Insurance (default tab, restricted)
/admin/hr/medical/dependents
/admin/hr/medical/insurance
/admin/hr/complaints/my-queue                            Complaints (default tab, restricted)
/admin/hr/complaints/escalated
/admin/hr/complaints/resolved
/admin/hr/payroll-liaison/hours-ready                    Payroll Liaison (default tab, new)
/admin/hr/payroll-liaison/statutory-summary
/admin/hr/payroll-liaison/remittance-history
```

---

## 4. Global HR Shell

Same shape as Finance Section 4: persistent entity context from `useUIStore`, breadcrumb (`HR / [Section] / [Tab]`), section-scoped search (employee names, credential numbers, complaint references where the viewer has access, candidate names), Quick Actions row gated by Section 7's matrix. One addition specific to HR: the shell itself checks route-level access before rendering the route at all for Medical & Insurance and Complaints, not just hiding the sidebar link, since a direct URL visit must be blocked the same way the link is hidden, otherwise hiding the link is theater.

---

## 5. State, Data & Real-Time Architecture

### 5.1 Client State (Zustand)

```
useHRStore
  activeEmployeeDrawerId: string | null
  activeLeaveDrawerId: string | null
  activeComplaintDrawerId: string | null   // only ever populated for authorized roles
  leaveFilters: { department, status, leaveType }
  timeTrackingFilters: { department, dateRange, logType }
  credentialsFilters: { type, expiryWindow }
```

No medical content, complaint content, or salary figures are ever held in this store. It tracks which drawer is open and what filters are active, nothing about the sensitive record itself; the sensitive data is fetched fresh per open, never cached client-side longer than the drawer is open.

### 5.2 Server State (TanStack Query)

```
['hr', 'overview', entityId, viewerRole]
['hr', 'employees', tab, entityId, filters]
['hr', 'employee', employeeId]
['hr', 'leave', tab, entityId, filters]
['hr', 'time-tracking', tab, entityId, filters]
['hr', 'interviews', tab, entityId]
['hr', 'promotions', tab, entityId]
['hr', 'credentials', tab, entityId]
['hr', 'medical', tab, employeeId]          // never fetched as a list, only per-employee, only for authorized viewers
['hr', 'complaints', tab, viewerRole]       // query itself is scoped server-side by viewer, not filtered client-side
['hr', 'payroll-liaison', tab, entityId, period]
```

The Overview query key includes `viewerRole` deliberately. Unlike every Finance query, which returns the same data to any Finance-permitted viewer, HR's Overview returns a different payload depending on who's asking, since the Open Complaints KPI card and the Activity Feed content differ by viewer (Section 8.0). This is stated explicitly because it's the one place a developer might assume "same role tier, same data" out of habit from building Finance first.

### 5.3 Real-Time (Pusher)

| Channel | Events | Triggers |
|---|---|---|
| `private-hr-employees` | `employee.created`, `employee.exited` | Invalidates directory, org structure |
| `private-hr-leave` | `leave.requested`, `leave.decided` | Invalidates leave queries, Overview KPI tier |
| `private-hr-time` | `time.anomaly.flagged`, `time.anomaly.resolved` | Invalidates time-tracking queries |
| `private-hr-recruitment` | `candidate.stage.changed`, `interview.scheduled` | Invalidates recruitment queries |
| `private-hr-promotions` | `role-change.proposed`, `role-change.step.decided` | Invalidates promotions queries, Unified Approvals Queue |
| `private-hr-credentials` | `credential.added`, `credential.expiring` | Invalidates credentials queries, Overview alert |
| `private-hr-complaints` | `complaint.filed`, `complaint.escalated`, `complaint.resolved` | Delivered **only** to channel subscribers with complaint access; subscription itself is access-checked server-side, not just the payload |

There is deliberately no `private-hr-medical` broadcast channel. Medical and insurance data changes do not push real-time updates to anyone; the relevant Drawer simply re-fetches on next open. Broadcasting medical-data change events, even as a content-free "something changed" ping, creates a metadata leak (who has medical changes happening, and when) that a slower, fetch-on-open pattern avoids.

### 5.4 Caching (Upstash Redis)

| Cache key | TTL | Invalidated by |
|---|---|---|
| `hr:overview:{entityId}:{viewerRole}` | 5 min | Relevant domain events per Section 5.3 |
| `hr:headcount:{entityId}` | 30 min | `employee.created`, `employee.exited` |
| `hr:org-structure:{entityId}` | 30 min | `employee.created`, `employee.exited`, role changes |

Note the cache key for Overview includes `viewerRole`, mirroring the query key in 5.2. Medical and Complaints data are never cached server-side either, for the same reason they don't broadcast: a cache is one more place sensitive data sits at rest beyond the database itself.

---

## 6. Confidentiality & Need-to-Know Design

This section governs every page below it. Read it once in full.

### 6.1 Tiered Visibility Model

| Tier | Data | Who sees it |
|---|---|---|
| Organization-wide | Directory, org structure, recruitment pipeline, credentials (non-medical) | HR Head, HR Officer, GM, CEO, Line Managers (their own division) |
| Team-scoped | Leave requests/balances, time & attendance, employment records | HR (all), GM, CEO, Line Manager (own direct reports only) |
| HR-and-above only | Complaints, career change proposals before they're decided | HR Head, GM, CEO (GM/CEO only once escalated or once their approval step is reached) |
| Self-and-HR only | Medical records, dependents, insurance policies | HR Head, GM, CEO (access-logged, see 6.3), and the employee themselves via self-service, never the employee's own Line Manager |

A Line Manager seeing their team's leave calendar does not imply they see why someone is on leave beyond the leave type category; medical detail behind a sick-leave request stays in the Medical & Insurance tier, not the Leave tier.

### 6.2 Absence, Not Restriction

Where a role lacks access to a tier, the corresponding sidebar link, route, and API response are all absent, not present-but-blocked. A 403 page or a greyed-out link both confirm to an unauthorized viewer that *something exists here*, which is itself information. The sidebar for a Line Manager simply has nine items instead of ten (Section 3.1); the API for `/api/hr/complaints` returns a 404-equivalent "not found" pattern rather than a 403 for a Line Manager's session token, not a 403, so the distinction between "this doesn't exist for you" and "this exists but you're blocked" isn't observable from outside.

### 6.3 Access Logging, Not Just Edit Logging

Every other module in this ERP, including Finance, logs mutations: who created, edited, approved, rejected something. Medical & Insurance additionally logs **views**: every time an authorized HR Head, GM, or CEO opens an employee's medical record, that view is appended to that record's Activity Log with actor and timestamp, visible to subsequent viewers of that same record (including, on request, to the employee themselves). This is the one place in the entire ERP where read access is treated as an event worth recording, because for this specific data category, knowing *who looked* matters as much as knowing *who changed something*.

### 6.4 Complaint Routing Is Hardcoded

Repeated here in full because it is the single most safety-critical rule in this module: a complaint naming a Department Head escalates to GM; a complaint naming the GM escalates to CEO; all other complaints stay with HR Head and never surface to a Line Manager, even one whose own report is involved, unless HR Head explicitly and narrowly requests fact-finding input through the "Request Input" action (Section 8.8), which can be scoped to a specific question without revealing the complainant's identity. **This routing is not implemented as a configurable RBAC permission.** It is conditional logic evaluated at complaint-filing time, the same way the master spec's SKILL.md guardrails describe it, specifically so a future change to the general RBAC matrix cannot accidentally widen who sees a complaint.

---

## 7. HR-Specific Permissions Matrix

| Action | HR Head | HR Officer | Line Manager (own team) | GM | CEO |
|---|---|---|---|---|---|
| View employee directory | Yes | Yes | Yes (own team) | Yes | Yes |
| Edit employee record | Yes | Yes | No | Yes | Yes |
| Approve leave (primary) | Yes (edge cases) | No | Yes (own team) | Yes (override) | Yes (override) |
| Manually adjust leave balance | Yes | No | No | No | No |
| View/manage complaints | Yes | No (unless delegated) | No | Only if escalated to them | Only if escalated to them |
| View/edit medical & insurance | Yes (logged) | No | No | View only (logged) | View only (logged) |
| Schedule interview / log outcome | Yes | Yes | View only (own division) | View | View |
| Propose promotion/demotion | Yes | No | Endorse only, cannot propose | No | No |
| Approve promotion/demotion | No* | No | No | Yes | Yes (Head-level roles only) |
| Manage credentials | Yes | Yes | No | View | View |
| Resolve time anomaly | Yes | Yes | Flag/comment only | View | View |
| Submit period hours to Finance | Yes | Yes | No | No | No |
| Initiate offboarding | Yes | No | No | Notified | Notified (Head-level roles) |

*HR Head proposes role changes but does not approve them, the same separation-of-duties control used for Finance Head and mandate approvals in the Finance spec. The person who initiates a change to someone's role or pay is structurally prevented from being the one who signs off on it.

---

## 8. Page-by-Page Functional Specification

### 8.0 Overview (`/admin/hr`)

Built last (Section 16), since its KPI tier and Activity Feed are rollups of every other page, and its content is genuinely viewer-dependent (Section 5.2), which is easiest to get right once the underlying pages and their access rules already exist and are proven.

**KPI Tier**

| Card | Formula | Notes |
|---|---|---|
| Headcount | `COUNT(employees)` where status = active, scoped to entity | Trend vs. prior period |
| Open Leave Requests | `COUNT(leave_requests)` where status = pending | Links to Leave > Requests |
| Credentials Expiring (30 days) | `COUNT(employee_credentials)` where expiry between now and +30d | Links to Credentials > Expiring |
| Time & Attendance Anomalies (Today) | `COUNT(time_logs)` flagged anomalous with today's date (Section 8.3 definition) | Links to Time & Attendance > Anomalies |
| Pending Career Changes | `COUNT(role_change_requests)` where any step is pending | Links to Career Changes > Pending Approval |
| Open Complaints | `COUNT(complaints)` where status != resolved | **Rendered only on HR Head's, GM's, and CEO's view of this page.** Absent, not zeroed-out, for every other viewer, per Section 6.2 |

**Alerts Panel:** leave requests pending beyond 3 business days, credentials already expired (not just expiring), complaints unresolved beyond SLA (HR Head/GM/CEO view only), unresolved time anomalies older than 2 days.

**Data Tier**

- **Activity Feed**, viewer-aware per Section 5.2: leave decisions, credential renewals, recruitment stage changes, and career-change step decisions appear by name to any HR-tier viewer. Complaint-related events appear, if at all, as a content-free "1 complaint update" line, and only on the HR Head/GM/CEO view, never naming the complainant or subject regardless of viewer.
- **Headcount Trend chart**, reusing the shared chart component from the Executive dashboard (Section 2), dataset swapped to headcount-by-department over time.

**Quick Actions** (gated by Section 7): Add Employee, Log Leave Request (admin-entry case), Add Credential, Propose Role Change.

---

### 8.1 Employees (`/admin/hr/employees`)

**Tabs:** Directory · Org Structure · Employment Records

#### Directory (default)

- **Columns:** Name, Department, Role, Line Manager, Status (active/on leave/suspended/exited), Start Date.
- **Filters:** department, division, status. Line Managers see this filtered server-side to their own reports by default; they cannot widen the filter to see other teams.
- **Row action:** opens the Employee Profile Drawer. If the record's Employment History runs long (more than roughly a screen's worth, the same 12-item heuristic used for Mandates in Finance), a "View Full Profile" link pushes to `/admin/hr/employees/[id]`.

**Employee Profile (Drawer, default; full page for the edge case)**

Sections: Personal Info, Employment History (timeline pulling from `role_change_requests`), Leave Balance summary, Credentials summary, recent Time & Attendance summary, Documents (contract, ID copy placeholders), Activity Log. **Medical, dependents, and insurance data are deliberately not shown here**, even as a summary, even to HR Head; they live only in the Medical & Insurance tab (8.7), reached by a separate, harder-gated path, because the viewer population for a general Employee Profile (Line Managers included) is wider than the viewer population for medical data, and bundling them would mean every future change to one page's access rules risks leaking into the other.

- **Modal — New Employee:** personal info, department, role, line manager assignment, employment date, contract type. On submit, creates the user and employee records and triggers default leave balance allocation per policy.
- **Row action — Initiate Offboarding:** Modal capturing exit date and reason, opens a checklist (credential/equipment return placeholder, a flag sent to Payroll Liaison for final pay processing). HR Head only. GM is notified for any exit; CEO is additionally notified for Head-level roles, mirroring the promotion/demotion sensitivity threshold in Section 7.

#### Org Structure

- Tree-style org chart, filterable by division, generated from `line_manager` relationships rather than manually maintained as a separate structure.

#### Employment Records

- A compliance-oriented register view: statutory identifiers (KRA PIN reference, NSSF number, SHIF number), start date, contract type, exportable for audit purposes, reusing the export infrastructure already built for Finance rather than a second one.

---

### 8.2 Leave (`/admin/hr/leave`)

**Tabs:** Requests · Balances · Calendar

#### Requests (default)

- **Columns:** Employee, Leave Type, Dates, Days, Status, Requested On.
- **Filters:** department, status, leave type.
- **Row action:** Drawer with full request detail, inline Approve/Reject. Line Manager is the primary approver for their own team; HR Head approves edge cases specifically (negative balance requests, disputed entitlement), per master spec 6.2. Rejection requires a notes field, same rule as everywhere else in the ERP.
- **Modal — Log Leave Request:** the admin-entry path for an employee without device access or for backfilling. The primary path is self-service (Section 1, assumption 2); this modal exists so HR is never blocked by the self-service surface not existing yet.

#### Balances

- Per-employee balance by type (Annual, Sick, Maternity/Paternity, Compassionate), with the accrual rule stated next to each type rather than hidden in a tooltip.
- **Modal — Adjust Balance:** HR Head only, reason required, logged in the employee's Activity Log.

#### Calendar

- Visual calendar of approved leave across a selected team or division, color-coded by leave type using opacity variants of the existing Brand Dark token plus a legend, rather than introducing new hues beyond the established palette.

**Downstream coordination:** approved leave, particularly unpaid leave, is visible read-only to Payroll Liaison (8.9) for the relevant period, feeding Finance's payroll calculation without HR re-entering anything.

---

### 8.3 Time & Attendance (`/admin/hr/time-tracking`)

**Tabs:** Office Clock Log · Field Logs · Timesheets · Anomalies

The clock-in/out action itself happens outside this admin dashboard (Section 1, assumption 2). Everything here is review, aggregation, and exception handling.

#### Office Clock Log (default)

- **Columns:** Employee, Date, Clock In, Clock Out, Hours, Flag (on-time/late/early-leave).

#### Field Logs

- **Columns:** Employee, Date, Clock In/Out, Duration, Geo-stamp indicator (present/absent), Linked Activity (optional context, e.g. a site visit reference, where another module supplies it).

#### Timesheets

- Aggregated per employee per period, with a "Ready for Payroll" status flag, the precondition checked before a period can be submitted on Payroll Liaison (8.9).

#### Anomalies

- **Definition, stated precisely rather than left implicit:** a log is anomalous if it has a clock-in with no clock-out past end of business day, a duration outside a configurable expected range, or, for field logs, a missing geo-stamp.
- **Row action — Resolve:** HR adjusts or annotates the entry, a note is required, logged in the Activity Log, same rigor as Finance's manual-entry corrections.
- **Modal — Log Manual Time Entry:** HR/Line Manager override for a missed clock event, reason required.

---

### 8.4 Recruitment (`/admin/hr/interviews`)

**Tabs:** Candidates · Interview Schedule · Outcomes

#### Candidates (default)

- Staged pipeline view: Applied → Screening → Interview → Offer → Hired/Rejected. Columns: Name, Role Applied For, Current Stage, Date Applied.
- **Modal — New Candidate.**

#### Interview Schedule

- Calendar view, panel assignment (multi-select interviewers), date/time, linked candidate.
- **Architectural note:** before building a second calendar system here, consider whether this should reuse the Front Office Appointments component and table (master spec 8.2) rather than duplicate it. Both are fundamentally "people, a time, a place" records. This is flagged as a build-time decision, not pre-decided here, since it depends on how generically Front Office's Appointments schema ends up being built.

#### Outcomes

- Post-interview outcome logging (Advance / Reject / Offer), which automatically updates the candidate's pipeline stage rather than requiring a second manual update.

**Downstream coordination:** a "Hired" outcome offers a "Convert to Employee" action that pre-fills the New Employee modal (8.1) with the candidate's existing data, so nothing is re-typed.

---

### 8.5 Career Changes (`/admin/hr/promotions`)

**Tabs:** Proposed · Pending Approval · Approved · Declined

This is HR's equivalent of Finance's Mandates page: the highest-stakes, most approval-heavy workflow in the module, and the one place this spec introduces a genuinely multi-step approval rather than the single-decider pattern used everywhere else in the ERP so far.

- **Columns:** Employee, Current Role/Band, Proposed Role/Band, Direction (promotion/demotion), Initiated By, Current Step, Overall Status.
- **Modal — Propose Role Change:** HR Head only. Employee, new role/band, justification, salary change amount (KES, `font-mono`).

**The approval chain (master spec 4.5, modeled as `approval_steps`):**

```
approval_steps
  id, approval_request_id, sequence_order,
  required_role (LINE_MANAGER_ENDORSEMENT | GM | CEO),
  status (pending | approved | rejected),
  decided_by, decided_at, notes
```

1. **Step 1, Line Manager Endorsement:** the employee's direct line either endorses or contests. A contest does not kill the request outright; it's visible to GM at Step 2 as a flag, since a Line Manager's disagreement is information GM should see, not a veto.
2. **Step 2, GM:** approves, rejects, or, for borderline cases, escalates onward.
3. **Step 3, CEO:** only required if the role change crosses a Head-level threshold or a configured salary band (master spec 4.7). For changes below that threshold, the request resolves at Step 2.

The overall `approval_requests.status` only flips to `approved` once every required step in sequence has approved; a rejection at any step ends the chain immediately rather than letting later steps proceed on a request already declined earlier. Inline Approve/Reject/Endorse controls appear on the Pending Approval tab for whichever party's turn it currently is, plus the item appears in the Unified Approvals Queue at whichever step it's currently sitting at, the same dual-surface pattern as Finance Mandates.

#### History (folded into Approved/Declined tabs rather than a fifth tab)

Approved and Declined together form the audit-friendly historical record; a separate "History" tab was considered and dropped as redundant with these two combined.

**Downstream coordination:** an approved change updates the Employee Profile's Employment History timeline (8.1) and notifies Finance Payroll (Finance spec 7.4) ahead of the next payroll run so the new band is reflected without a manual heads-up.

---

### 8.6 Credentials (`/admin/hr/credentials`)

**Tabs:** Active · Expiring (30/60/90 day windows) · Expired

- **Columns:** Employee, Credential Type, Number, Issue Date, Expiry Date, Status.
- **Modal — Add Credential**, **Renew Credential** (updates expiry, logs renewal in Activity Log).

**Downstream coordination:** an expired Driving License on a Driver-role employee flags to Front Office (master spec 8.1), since that employee should not remain assignable to vehicle trips while expired. An expired Valuer license flags relevance to Sunland Valuers Ltd compliance tracking. Neither integration blocks the credential record itself from existing; it surfaces a warning on the other module's side.

---

### 8.7 Medical & Insurance (`/admin/hr/medical`)

**Tabs:** Medical Records · Dependents · Insurance Policies

Governed in full by Section 6. Not rendered in the sidebar, not reachable by direct URL, for any role outside HR Head, GM, and CEO (each access logged per 6.3). There is no department-wide browsable list here; a record is only reached by navigating from a specific employee, never the reverse.

- **Medical Records:** scheme enrollment, claims history if tracked, a conditions/notes field, treated as the most sensitive field in the entire ERP and a candidate for encryption at rest, flagged here as a build-time security decision rather than assumed.
- **Dependents:** next-of-kin and family records, linked to insurance beneficiaries.
- **Insurance Policies:** policy numbers, coverage type, beneficiary linkage to Dependents.
- **Modal — Add Dependent**, **Update Medical Record** (HR Head only, reason logged, view of the change also logged per 6.3).

---

### 8.8 Complaints (`/admin/hr/complaints`)

**Tabs:** My Queue · Escalated · Resolved & Closed

Governed in full by Section 6.4. Not rendered in the sidebar for any role outside HR Head, GM, and CEO, and for GM/CEO, only items currently escalated to them are visible, never the full queue.

- **My Queue (HR Head's working view):** list shows category and status only, not full content, complainant shown as "Anonymous" if the anonymous-submission toggle was used. Status, date filed, SLA countdown.
- **Escalated:** items currently sitting with GM or CEO per the hardcoded routing rule.
- **Resolved & Closed:** archive.
- **Drawer:** full detail, restricted to HR Head, the complainant, and, only if escalated, the specific GM or CEO it's escalated to. Not visible to other HR Officers unless HR Head explicitly delegates a specific case. Actions: Add Note, **Request Input** (a scoped fact-finding question sent to a named party without revealing the complainant's identity if anonymous), Escalate, Resolve (requires a resolution summary).
- **Modal — Log Complaint:** self-service is the primary path; this exists for HR to log something reported verbally, with an Anonymous toggle.

**Activity feed exclusion, restated from 8.0:** nothing here ever appears by name or content anywhere outside this page and its Drawer, including the Overview Activity Feed, regardless of viewer.

---

### 8.9 Payroll Liaison (`/admin/hr/payroll-liaison`)

**Tabs:** Hours Ready · Statutory Summary · Remittance History

**Why this page exists:** master spec 6.7 describes HR generating finance-facing payroll reports, but the original route map didn't give that a dedicated home, leaving it as an implied sub-feature of the Time & Attendance or Payroll pages. This page makes the HR-to-Finance handoff (master spec 4.2) a first-class, visible workflow rather than something that happens invisibly between two modules.

#### Hours Ready (default)

- Per period, aggregated and approved time logs (sourced from 8.3 Timesheets) ready for handoff.
- **Action — Submit Period to Finance:** HR Head or Officer. Once submitted, the period becomes read-only on the HR side; HR cannot silently re-edit hours after handoff. If an error is found post-submission, the correction is requested through Finance (Finance spec 7.4), not re-entered here, preserving a single, traceable point-in-time handoff rather than two systems quietly disagreeing about the same period.

#### Statutory Summary

- Read-only mirror of PAYE/NSSF/SHIF/Affordable Housing Levy projections, sourced from Finance's calculation once available, not recalculated independently here. This is intentionally a mirror, not a second source of truth.

#### Remittance History

- Read-only history of completed remittances, scoped for HR visibility, mirroring Finance's own Payroll > Remittances tab (Finance spec 7.4) without granting HR edit rights into it.

**The boundary, stated plainly:** HR owns hours. Finance owns payroll execution. This page is where that boundary is visible and enforced in the UI, not just understood informally between two departments.

---

## 9. Escalation & Approval UX

### 9.1 Single-Step vs. Multi-Step

Most HR approvals (leave, credential disputes, complaint resolution sign-off) follow the same single-decider pattern as Finance: one Confirm Dialog, one decision, done. Career Changes (8.5) is the exception, using the `approval_steps` sequence described there. Both patterns share the same underlying `approval_requests` row and the same dual-surface principle (Section 9.2); the difference is only in how many decisions are required before the overall status resolves.

### 9.2 Where Approvals Surface

Same as Finance Section 8.1: inline on the relevant page for the party whose turn it currently is, and in the Unified Approvals Queue for cross-department visibility. For multi-step Career Changes specifically, an item only appears as "actionable" to the party whose step is currently pending; a GM does not see Approve/Reject controls on a request still waiting on Line Manager endorsement, only its current status.

### 9.3 What Happens on Decision

Identical mechanics to Finance Section 8.3: approve executes immediately (or advances to the next step, for multi-step requests) and logs to the Activity Log; reject requires notes and reverts the underlying record to an editable state; escalation (GM to CEO) moves the item and notifies the GM once resolved. The one HR-specific addition: a Line Manager's "contest" at the endorsement step (8.5) does not function as a rejection, it's a flag carried forward to the next decider rather than an end state, which is different enough from anything in Finance that it's worth this explicit callout.

---

## 10. Cross-Department Downstream Coordination Matrix

| HR action | Department affected | What changes there |
|---|---|---|
| Period hours submitted (Payroll Liaison) | Finance | New payroll run becomes createable for that period (Finance spec 7.4) |
| Career change approved | Finance | Salary band update reflected ahead of next payroll run |
| Offboarding initiated (Head-level role) | Executive | CEO notified directly, GM notified for all exits |
| Credential expired (Driver role) | Front Office | Employee flagged as not assignable to vehicle trips until renewed |
| Credential expired (Valuer role) | Business Development / Valuers Ltd | Compliance flag surfaced on relevant records |
| Complaint escalated naming a Department Head | Executive (GM) | Appears in GM's Escalated queue |
| Complaint escalated naming the GM | Executive (CEO) | Appears in CEO's Escalated queue |
| Interview scheduled (if reusing Front Office Appointments) | Front Office | Appears on shared appointments calendar |
| Any HR approval decision | Executive | Item clears from the Unified Approvals Queue |

---

## 11. Redirect & Navigation Rules

| After this action | User lands here | What they see |
|---|---|---|
| Approve leave request | Stays on Requests tab | Row updates status via real-time refetch, toast confirms, employee notified |
| Submit period to Finance | Stays on Hours Ready tab | Period marked read-only, toast confirms handoff, Finance notified |
| Propose role change | Career Changes > Proposed | New row at Step 1, Line Manager Endorsement |
| Endorse / contest (Line Manager) | Stays on current view | Item moves to GM's Pending Approval, contest shown as a flag, not a rejection |
| Approve role change (final step) | Stays on current tab | Row moves to Approved, requester and employee's profile both update |
| Resolve complaint | Returns to My Queue | Item moves to Resolved & Closed, resolution summary stored |
| Add credential | Stays on Active tab | New row appears, Expiring/Expired tabs recompute on next load |
| Add medical record | Stays on Medical Records tab | Activity Log on that record gets both a mutation entry and a view entry for the action itself |

---

## 12. Notification & Badge System

Same mechanics as Finance Section 11: sidebar group and sub-link badges reflect pending counts and SLA breaches, severity colored amber/rose, no separate notification center beyond badges plus the existing Toast system. The one HR-specific rule: Complaints and Medical & Insurance badges, where they exist at all, render only inside the already-access-checked sidebar render for HR Head/GM/CEO (Section 6.2); there is no "1" badge bleeding through to a Line Manager's otherwise absent Complaints link, because there is no Complaints link for them to bleed through to.

---

## 13. Component Inventory

| Component | Used on |
|---|---|
| `HROverviewBoard`, `HRAlertsPanel`, `HRActivityFeed` (viewer-aware) | 8.0 |
| `HeadcountTrendChart` (shared chart component, new dataset) | 8.0 |
| `EmployeeDirectoryTable`, `EmployeeProfileDrawer`, `EmployeeFullProfilePage` | 8.1 |
| `OrgStructureChart`, `EmploymentRecordsTable` | 8.1 |
| `NewEmployeeModal`, `OffboardingModal` | 8.1 |
| `LeaveRequestsTable`, `LeaveRequestDrawer`, `LeaveBalancesTable`, `LeaveCalendar` | 8.2 |
| `LogLeaveRequestModal`, `AdjustBalanceModal` | 8.2 |
| `OfficeClockTable`, `FieldLogsTable`, `TimesheetsTable`, `AnomaliesTable` | 8.3 |
| `ManualTimeEntryModal` | 8.3 |
| `CandidatePipelineBoard`, `InterviewScheduleCalendar`, `OutcomesTable` | 8.4 |
| `NewCandidateModal`, `LogOutcomeModal` | 8.4 |
| `CareerChangesTable`, `RoleChangeStepWidget` (the multi-step approval UI) | 8.5 |
| `ProposeRoleChangeModal` | 8.5 |
| `CredentialsTable`, `AddCredentialModal`, `RenewCredentialModal` | 8.6 |
| `MedicalRecordsPanel`, `DependentsTable`, `InsurancePoliciesTable` (all access-logged) | 8.7 |
| `ComplaintsQueueTable`, `ComplaintDrawer` (heavily access-scoped) | 8.8 |
| `LogComplaintModal` | 8.8 |
| `HoursReadyTable`, `StatutorySummaryView`, `RemittanceHistoryTable` | 8.9 |
| `HRActivityLog` (shared across drawers, extends the Finance pattern with a view-logging mode for 8.7) | All drawers, Section 6.3 |
| `SidebarGroupBadge` (shared with Finance) | Section 3.1, 12 |

---

## 14. Performance & Caching Summary

Covered in full in Section 5.4. Only Overview, headcount, and org structure are cached, the only views that aggregate widely rather than reading a filtered list. Medical and Complaints data are explicitly excluded from caching and from real-time broadcast, not for performance reasons but because every additional place sensitive data sits, even briefly, is a surface to secure and audit.

---

## 15. HR-Specific Verification Checklist

In addition to the generic checklist in the master spec (Section 12):

- [ ] Medical & Insurance and Complaints links are absent, not greyed out, in the rendered sidebar for unauthorized roles.
- [ ] A direct URL visit to a restricted HR route by an unauthorized role returns a not-found pattern, not a 403.
- [ ] Complaint routing logic (Dept Head → GM, GM → CEO) is hardcoded, confirmed not implemented as a configurable RBAC rule.
- [ ] Viewing a Medical Record appends a logged view event, distinct from edit events, visible in that record's Activity Log.
- [ ] No real-time event fires for any Medical & Insurance change, broadcast or otherwise.
- [ ] Career change requests resolve only after every required `approval_steps` row in sequence is approved; a rejection at any step halts the chain.
- [ ] A Line Manager's "contest" at the endorsement step does not block the request from reaching GM.
- [ ] HR cannot edit hours for a period already submitted to Finance via Payroll Liaison.
- [ ] Clock-in/out is confirmed to live outside `/admin/hr` entirely, in the self-service surface.
- [ ] The Overview Activity Feed never names a complainant or subject, on any viewer's screen, under any circumstance.

---

## 16. Build Sequence for This Module

A finer-grained breakdown of master spec Phases 4–5, specific to HR. Note the order is shaped by confidentiality-pattern maturity as much as by data dependency, the two most sensitive modules are built last on purpose, after the access-control approach has already been proven elsewhere.

1. Employee Records and Org Structure, the foundation every other page links back to.
2. Time & Attendance (office and field logging, anomaly detection), since master spec Phase 4 bundles this with Employee Records and Finance's Payroll needs it soon after.
3. Leave Management.
4. Payroll Liaison (Hours Ready, Statutory Summary, Remittance History), closing out Phase 4 and unblocking Finance's own Payroll module.
5. The `approval_steps` schema extension (Section 9), built once, ahead of Career Changes, as shared infrastructure rather than a one-off.
6. Career Changes, using the new multi-step approval pattern.
7. Recruitment, deciding at this point whether Interview Schedule reuses Front Office's Appointments component (8.4) or ships standalone.
8. Credentials.
9. Complaints, built deliberately after every other module's RBAC and Activity Log patterns are proven, since this is the costliest module in the spec to get wrong and benefits most from not being a first attempt at access control.
10. Medical & Insurance, last of the department-specific pages, for the same reason as Complaints, additionally requiring the view-logging pattern to already be proven on Complaints' access model first.
11. Overview, last overall, since it's a viewer-aware rollup of everything above and only resolves correctly once those pages and their access rules already exist.
