# Architecture Decisions

This file records foundation decisions that future ERP work must preserve.

## ADR 001: ERP Spec Supersedes CRM Scope

`SUNLAND_ERP_IMPLEMENTATION_SPEC.md` is the single product and architecture source of truth. The retired CRM spec was removed because it contained obsolete routes, roles, build order, and module ownership.

The CEO/Admin dashboard prototype, Terrain Identity, entity switcher, operations module, and shared UI primitives remain locked reference implementations.

## ADR 002: Finance Is the Core Engine

Finance is not treated as a side dashboard. Ledger, chart of accounts, approval enforcement, rental management, mandates, payroll handoff, payables, receivables, and report verification are built before downstream department workflows rely on financial state.

No department owns an independent money balance. Balances are derived from ledger lines.

## ADR 003: Entity Scope Is Mandatory

ERP data is scoped to one of the Sunland entities:

- Sunland Group.
- Sunland Commercial.
- Sunland Residential.
- Sunland Valuers Ltd.

Every new ERP table carries `entity_id` unless it is purely global configuration. Existing CRM-era tables are being migrated toward this rule.

## ADR 004: Approval Engine Is Shared Infrastructure

Approval behavior is implemented through a generic `approval_requests` table. Departments do not create bespoke approval tables for payroll, petty cash, mandate activation, cheques, leave, or promotions.

Server-side approval checks are mandatory for consequential writes. Client-side gating is presentation only.

## ADR 005: Routes Are Department-Scoped Under `/admin` - ⚠️ SUPERSEDED by ADR 009

Canonical department routes live under `/admin`:

- `/admin/finance`
- `/admin/hr`
- `/admin/business-development`
- `/admin/front-office`
- `/admin/maintenance`
- `/admin/approvals`

Legacy short routes such as `/fin`, `/hr`, and `/ops` may remain only as temporary redirects and must not host new functionality.

## ADR 005.1: Next.js 16 Edge Proxy replacing Middleware
In Next.js 16.2+, the standard `middleware.ts` convention is deprecated in favor of `proxy.ts`. We adhere to this Edge Proxy convention, implementing the route guard logic inside [proxy.ts](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/proxy.ts) and exporting a named `proxy` function to authorize incoming requests.

## ADR 006: Realtime Transport Naming

The ERP spec names Pusher Channels as the target realtime layer. The current codebase contains an Ably adapter from the earlier prototype. Until transport migration is scheduled, realtime access stays isolated behind `src/lib/realtime/*` so department code does not depend directly on a vendor SDK.

## ADR 007: Landing Page Redirection and Access Emulation Profiles - ⚠️ role list SUPERSEDED by ADR 013

To make local development, QA, and client review streamlined, the main landing page (`/`) redirects automatically to the secure `/login` route.
The login page contains an "Authorized Workspace Portals" switcher that emulates the six core client roles we are building out dashboards for:
1. CEO (`ceo` - Paul Amos)
2. General Manager (`general_manager` - Grace Mutua)
3. Head of Finance (`finance_head` - Dennis Munge)
4. Head of HR (`hr_head` - Cody Fisher)
5. Line Manager / Business Dev (`line_manager` - Jared Omondi)
6. Front Office Lead (`front_office_head` - Sharon Koech)

All emulated profiles are backed by real database users seeded in both `src/db/seed.ts` (CLI) and `src/app/api/auth/seed/route.ts` (API route) using the default password `sunland-demo` to preserve compatibility.

> **Superseded:** the six-role list above predates the client's finalized org structure. "Line Manager" no longer exists (folded into Property Manager mid-build); Head of Strategy, Admin (CEO's Assistant), Senior Accountant, and Internal Auditor are new. The mechanism this ADR describes (emulated login profiles backed by real seeded users) still stands - only the roster is stale. See ADR 013 for the current roster.

## ADR 008: Universal Self-Service Access Paths - ⚠️ SUPERSEDED by ADR 010
Common account modules (Profile, Settings, Security, Messages, Notifications) are hosted under the `/admin` path group but are whitelisted under `UNIVERSAL_PATHS` in [roles.ts](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/lib/auth/roles.ts). This ensures that any authenticated employee (e.g. Finance Officer, HR Head) can manage their personal profiles, preferences, and communications without triggering role-based redirects to their department's dashboard roots.

> **Superseded:** hosting self-service under a single `/admin` group is the root cause of the "in `/fin` but Profile routes to `/admin/profile`" defect - it drops users out of their portal shell. Replaced by portal-local self-service (ADR 010). The original is kept for history.

---

## ADR 009: Independent Portal Route Groups - supersedes ADR 005
**Decision:** Every role's dashboard is an independent Next.js route group with its own root and shell: `/exec` (CEO/GM), `/fin`, `/hr`, `/bd`, `/front`, `/ops`, and the external `/landlord` and `/tenant`. No department's functionality lives under another portal's root. The former model of hosting departments under `/admin/*` (ADR 005) is retired; `/admin` becomes - at most - just the executive portal's own root, never a catch-all others nest under.

**Why:** the code had already diverged from ADR 005 (Finance was fully built as an independent `(fin)/fin` group, not at `/admin/finance`), leaving HR/BD/Front-Office stranded under `/admin`. This ADR ratifies the direction the code took and mandates finishing it for every role. Independence is of *route + shell*; the system stays unified through shared data, the ledger, and the approval/notification engines - not shared routes.

**Rationale & build detail:** `docs/SUNLAND_DASHBOARD_PORTAL_ARCHITECTURE.md`.

---

## ADR 010: Portal-Local Self-Service - supersedes ADR 008
**Decision:** Profile, Settings, Security, Notifications, and Messages are rendered **within each portal's own shell**, from **shared components**, at portal-local routes (`/fin/profile`, `/hr/profile`, …). There is no global `/admin/profile`. `UNIVERSAL_PATHS` is removed; the self-service segments (`profile|settings|security|notifications|messages`) are simply permitted under any portal root the user can access. A `usePortalPrefix()` helper + `PortalContext` ensure shared components link within the active portal and never hardcode `/admin/*`.

**Why:** independence of route with unity of implementation - one `ProfilePage` component, rendered locally in every portal - fixes the cross-shell jump while avoiding duplicated code.

---

## ADR 011: Permission-Based, Two-Layer Authorization - extends ADR 004
**Decision:** Authorization is permission-based (`<module>.<resource>.<action>` keys in a `permissions`/`roles`/`role_permissions`/`user_roles` model), enforced at **two layers**: (1) an edge route guard (`proxy.ts`) that gates *which portals* a user may load, and (2) service-level `authorize(ctx, key)` that gates *which actions* a user may perform. Route-prefix gating alone (the current `roleAccess` map) is retired as the sole mechanism. The CEO super-admin holds every permission explicitly (seeded, data-driven - not a code-level bypass); the dev auth bypass no longer defaults to on.

**Why:** route gating cannot express "may view remittances but not approve them." Action-level checks inside the single service write path (ADR-002-adjacent) are the only place money-affecting authority can be enforced and audited.

**Rationale & build detail:** `docs/SUNLAND_BACKEND_ARCHITECTURE_MASTER.md` §3, `docs/SUNLAND_DASHBOARD_PORTAL_ARCHITECTURE.md` §5–6.

---

## ADR 012: CEO/System-Administration Is Real API Surface, Not Just a Data Model - extends ADR 011

**Decision:** Built ahead of P1, at the client's explicit direction to make CEO backend authority "the guide going forward." The permission model (ADR 011) is now backed by a full management surface: user CRUD (`/api/identity/users*`), role/permission CRUD (`/api/identity/roles*`, `/api/identity/permissions`), role-grant management (`/api/identity/users/[id]/roles`, `/api/identity/user-roles/[id]`), session listing/revocation (`/api/identity/sessions*`), entity settings/thresholds (`/api/settings`), and an audit-log explorer (`/api/audit`). Sessions are now genuinely revocable (a `sessions` row per login, checked on every `getCurrentUser()` call), not just a table sitting unused.

**Why:** a permission catalog that CEO holds every key of is oversight in name only until there's a real surface to exercise it through - grant/revoke roles, deactivate an account, kill a session, inspect the audit trail. This ADR makes that surface exist and pins down the rules future work must preserve:
1. **`isLastSuperAdmin()`** blocks deactivating or CEO-role-stripping the sole remaining active CEO. Checked inline in `updateUserAccess` and `revokeUserRole`, not layered on as an afterthought.
2. **System roles are immutable via the API.** All 16 real roles are `isSystem: true`; `seedPermissionCatalog()` fully replaces their `role_permissions` on every seed, so an API-side edit would silently vanish. Only custom (non-system) roles can be edited/deleted through the API.
3. **Department heads are global-scope, officers are entity-scope.** Caught live, not designed upfront: `finance_head`/`hr_head`/`front_office_head` must be `scopeType: "global"` (matching the seed data's own choice of `primaryEntityId = group` for heads vs. a specific entity for officers), or a department head scoped only to "Group" cannot act on a resource belonging to any other entity.
4. **No email service exists**, so `createUser` returns a one-time plaintext temporary password in its response rather than building a speculative invite/reset-token flow nothing else needs yet.

**Rationale & build detail:** `docs/SUNLAND_BACKEND_ARCHITECTURE_MASTER.md` §3.4, `docs/SUNLAND_DASHBOARD_PORTAL_ARCHITECTURE.md` §6.

---

## ADR 013: Client-Directed Role Model Update (2026 Q3) - extends ADR 011, updates ADR 007

**Decision:** The client supplied a finalized organizational role roster, replacing the six-role emulation set in ADR 007 and resolving the two placeholders `.agents/skills/workflow-fixes/SKILL.md` had left open ("Admin (CEO's Assistant)" and "Head of Strategy," previously deferred to "a future sprint"). That sprint is this ADR.

**The roster, in full:**

| Role | Slug | Scope | Reports to | Status |
|---|---|---|---|---|
| Chief Executive Officer | `ceo` | global | - | Unchanged |
| General Manager | `general_manager` | global | CEO | Unchanged |
| **Head of Strategy** | `head_of_strategy` | global | GM | **Implemented - see ADR 014** |
| Property Manager | `property_manager` | entity | Head of Strategy | Unchanged role, new reporting line |
| Head of Finance | `finance_head` | global | GM | Unchanged |
| **Senior Accountant** | `finance_officer` (relabeled) | entity | Finance Head | **Renamed**, same permission scope |
| **Internal Auditor** | `auditor_compliance` (relabeled) | global | GM (dotted line to CEO) | **Renamed** + **new time-gated access rule** |
| **Admin (CEO's Assistant)** | `admin_assistant` | global | CEO | **New** |
| Head of HR | `hr_head` | global | GM | Unchanged |
| Front Office Head | `front_office_head` | global | GM | Unchanged |
| Landlord | `landlord` | self | - | Unchanged (spec exists, not yet built - see tenant/landlord portal doc) |
| Tenant | `tenant` | self | - | Unchanged (spec exists, not yet built), **complaint routing changed** |

### 13.1 Head of Strategy - the BD/property-management department head

**Decision:** `head_of_strategy` is a new global-scope role sitting above everything the BD dashboard spec (`SUNLAND_BD_DASHBOARD_SPEC.md`) describes as "Line Manager" territory. Per the client: Head of Strategy owns **Property Managers, Line Managers, Sales, and Marketers** - i.e., every commercial/BD-facing function reports through this one department head, the same way Finance reports through Finance Head and HR through HR Head.

This is additive to, not a replacement for, the `property_manager` consolidation already in the codebase (`line_manager`/`bd_agent`/`bd_head`/`agent` were folded into `property_manager` earlier this build - see `src/lib/authz/catalog.ts`'s retired-alias comment). `head_of_strategy` sits *above* `property_manager` in the reporting chain; it does not merge into it.

**Permissions (implemented 2026-07-10 per ADR 014 §14.3, exactly as proposed here - mirrors `finance_head`'s oversight shape):**
```
...keysFor("crm")            // full pipeline/contact oversight, not just their own leads
...keysFor("properties")     // full property/lease/maintenance oversight
...keysFor("scheduling")
...keysFor("operations")     // Projects - Head of Strategy is exactly who runs cross-dept initiatives
identity.user.read           // sees their own reports (property managers, sales, marketers)
settings.entity.read
audit.log.read
```
Global scope (`scopeType: "global"`), matching the established rule that department heads are global while officers are entity-scoped (ADR 012 point 3) - a Head of Strategy overseeing property managers across Commercial *and* Residential cannot be scoped to one entity any more than Finance Head can.

### 13.2 Property Managers - explicit dual landlord + tenant scope

**Decision:** Property Managers are confirmed as the single point of contact for **both** landlords and tenants on any property under Sunland's management - not just the landlord-facing mandate relationship the role already had. Per the client: *landlords defer all responsibility for managing their properties to Sunland*, which makes the assigned Property Manager the de facto tenant-relationship owner too, by extension of that mandate.

**Concretely, this means:**
- Tenant complaints/maintenance requests route to the property's assigned Property Manager, not a generic Front Office/Ops queue (supersedes the routing described in `SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md` §3.2/§6 - see that doc's updated version).
- Rent arrears visibility for a Property Manager's assigned properties is a first-class view, not something they have to cross into Finance to see.
- Miscellaneous tenant charges (new - see §13.5 below) are also a Property Manager concern.

The client's own framing was that Property Managers should be able to **"handle this all dynamically"** - one working surface per property/tenant, not three separate siloed pages for complaints, arrears, and misc charges. This is a UI/aggregation requirement for whenever the Property Manager portal is built (tenant/landlord portal doc §7 build sequence), not a new table - all three data sources (`maintenance_requests`, `rental_ledger`/lease arrears, and the new misc-charges table) already carry `propertyId`, so a "my properties, everything outstanding" view is a query, not a schema change.

No new permissions needed - `property_manager` already holds `...keysFor("properties")` (covers `properties.maintenance.*`) from the existing catalog; the change is in routing/visibility logic (who gets notified, whose queue it lands in), documented in the tenant/landlord portal spec update.

### 13.3 Finance: Senior Accountant + Internal Auditor

**Decision:** The client named two Finance-department staff roles: **Senior Accountant** and **Internal Auditor**. Mapped onto the existing schema rather than inventing parallel roles that duplicate what's already seeded:

- **Senior Accountant = `finance_officer`, relabeled.** The existing `finance_officer` role (entity-scoped, day-to-day transaction/ledger work) already matches the job description implied by "Senior Accountant" - general ledger entries, transaction recording, rentals/mandates support. No permission change; this is a display-name/title clarification (`name: "Finance Officer"` → `"Senior Accountant"` in `SYSTEM_ROLES`), flagged here as a proposed mapping for the client to confirm rather than assumed silently.
- **Internal Auditor = `auditor_compliance`, relabeled, plus a genuinely new access rule** (§13.4).

### 13.4 Internal Auditor's 90-day delayed finance access - a new authz primitive

**Decision:** An Internal Auditor **requires access to the finance dashboard only after 3 months** in the role. Read literally, this is a probation/trust period: the auditor role is granted immediately (they can start working - org-wide read access per `auditor_compliance`'s existing `allReadKeys()` grant), but the specific slice of that grant covering `finance.*` permissions activates only once 90 days have elapsed since the role was assigned.

**This is the first time-conditional permission in the system.** Nothing in the current `authorize()`/`can()`/`resolveActorPermissions()` chain (`src/lib/authz/{can,resolve}.ts`) has any concept of "granted, but not yet active." Two ways to build it, and the recommended one:

- **(Rejected) Delay the `user_roles` insert itself** - don't grant `auditor_compliance` until day 90. Simpler, but wrong: the client's intent is that the person *is* the Internal Auditor from day one (title, non-finance read access, presumably other duties) - only the finance slice is gated, not the whole role.
- **(Recommended) A `roleGrantedAt` timestamp on `user_roles`, checked inside `authorize()` for finance-module keys only.** Concretely: `user_roles` gains a `grantedAt` column (defaults to `now()`, already implicit via `createdAt` if `...timestamps` is already spread there - confirm and reuse rather than add a duplicate column). `authorize(ctx, key, entityId)` gets a narrow addition: if `key.startsWith("finance.")` and the resolved grant coming from an `auditor_compliance` role assignment is less than 90 days old, treat it as not-yet-granted (throw `ForbiddenError`) even though `can()` would otherwise return `true`. This keeps the general permission model untouched for every other role/module and scopes the new time-gate narrowly to the one case that needs it, rather than generalizing a "probation period" concept the rest of the system doesn't ask for yet.

**Not yet implemented** - this ADR records the decision and the mechanism; the `authorize()` change and the `user_roles.grantedAt` column are next-sprint work, tracked against this ADR.

### 13.5 Admin (CEO's Assistant) - proposed permission design

**Decision:** The client explicitly left this open - *"we'll figure how to auth this based on all other roles, this will be curated to aiding CEO activities"* - so what follows is a **proposed design**, not a client-dictated spec, flagged as such for confirmation before it's built.

Admin is framed as two things at once: partial HR function, and direct CEO support (scheduling, executive requests, triage). The proposed permission set reflects both halves without granting either full HR authority or financial approval authority - an assistant amplifies the CEO's reach, it doesn't inherit the CEO's sign-off power:

```
identity.user.read            // HR-adjacent: can see the org, not edit roles/access (that stays CEO-only)
settings.entity.read          // visibility into thresholds, no write
audit.log.read                // same oversight-adjacent read CEO/GM/Finance Head already get
...keysFor("scheduling")      // runs the CEO's calendar - this is the core "assistant" function
support.ticket.manage         // triages the "admin is the main support endpoint" queue on the CEO's behalf
crm.contact.read, crm.lead.read   // read-only visibility to brief the CEO, no pipeline editing
properties.property.read, properties.lease.read, properties.maintenance.read   // same, read-only briefing visibility
```

**Explicitly excluded:**
- `finance.*` (any) - no approval or transaction authority.
- `hr.complaint.manage` - complaints are confidentiality-gated to HR Head/GM/CEO by hardcoded routing (HR spec §6.4); Admin assisting the CEO does not extend to reading complaint content, including complaints escalated *to* the CEO.
- `operations.project.write` - Admin can see projects (read-only, via a future `operations.project.read` grant if the client wants visibility) but doesn't run them.
- `identity.role.write`, System Administration - CEO-exclusive per ADR 012, unchanged.

Scope: `global` (an assistant to the CEO isn't tied to one operating entity, matching every other department-head-tier role in this system).

### 13.6 Tenant/Landlord portal: complaint routing + miscellaneous charges

Covered in full in the updated `SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md`:
- Tenant complaints/maintenance requests now route to the property's assigned **Property Manager**, not a generic Front Office/Ops queue.
- A new **Miscellaneous Charges** category (water, garbage - **explicitly not electricity**, which runs on a prepaid token system entirely outside Sunland's ledger) joins rent as a tenant-payable charge type, handled by Property Managers.

### 13.7 What this ADR does *not* change

- The permission catalog's module structure (`<module>.<resource>.<action>`, ADR 011) - new roles are new grants of existing or narrowly-added keys, not a new authz model.
- `property_manager`'s existing entity-scoped permission set - Head of Strategy is a new role *above* it, not a rename of it.
- The tenant/landlord identity model (`users.contactId`, `isExternal`, `external_invitations`) - still not built; this ADR only changes who a tenant's complaint routes to once that portal exists.

**Supersedes:** ADR 007's six-role emulation list (CEO, GM, Finance Head, HR Head, Line Manager, Front Office Head) is stale - "Line Manager" no longer exists as a role (folded into Property Manager earlier this build), and the roster above is now the canonical set. ADR 007 is kept for history with a superseded marker rather than deleted, per this file's own convention.

**Rationale & build detail:** `.agents/skills/workflow-fixes/SKILL.md` (design notes, non-canonical scratch space), `docs/SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md` (complaint routing + misc charges), `docs/SUNLAND_FINANCE_LEDGER_ARCHITECTURE.md` §8 (downstream data-flow model, added alongside this ADR).

---

## ADR 014: Mandate Letter Flow - Corrected Model, Role-Based Approval, Landlord Verification

**Context:** The Property Portfolio overhaul's WS3 workstream built a `property_mandates` anchor table and CEO-admin surfaces (property full-view rail card, create/terminate actions) against a simplified reading of the approval rule - "mandate activation always needs GM sign-off, CEO additionally above 10 units or KES 5M annualized" (Executive Dashboard spec §6.2) - treated as a flat rule applying to every mandate regardless of who creates it. The client clarified this is wrong on two counts: (1) the mandate letter is a real contract document produced partway through a multi-step landlord-onboarding flow, not just a status on an anchor row, and (2) the approval requirement depends on *who* is creating the mandate - a Property Manager or Head of Strategy always needs GM sign-off, but the CEO does not wait for anyone (nothing sits above the CEO to escalate to), and by the same logic a GM does not need GM sign-off from a *different* GM.

### 14.1 The real landlord-onboarding sequence

Per `SUNLAND_ERP_IMPLEMENTATION_SPEC.md` §4.3, `SUNLAND_BD_DASHBOARD_SPEC.md` §8.1/§8.4, and `SUNLAND_FRONT_OFFICE_DASHBOARD_SPEC.md` §8.4 (all pre-existing, cross-referenced, and mutually consistent - this ADR did not invent this flow, it recovers it and reconciles it with the client's plain-language description):

```
Property Manager prospects a landlord (BD Landlords > Prospecting tab)
  stage: Initial Contact → Proposal Sent → Negotiating → Mandate Drafted
         ─────────────────┬──────────────
                  "Proposal Sent" is the informal offer - terms proposed
                  to the landlord before any contract is signed. There is
                  no separate tracked "Offer Letter" document for the
                  landlord side today (unlike the tenant/buyer-side Offer
                  Letters in Front Office Paperwork, which are generated
                  from a closed listing deal, BD spec 8.2) - it is a
                  Prospecting *stage*, not a document artifact, until the
                  BD Landlords page is actually built.
       ↓ (landlord accepts - "Mandate Drafted")
Property Manager submits a mandate letter draft request
  (BD Liaison & Requests page, routes to Front Office Paperwork queue)
       ↓
Front Office formalizes the Mandate Letter
  (templated document - the actual contract that seals the agreement,
   documents.type = 'mandate_letter', linked to the property + landlord
   contact; this is the artifact the client means by "mandate letter")
       ↓
Approval - see 14.2 below (GM always for PM/Head-of-Strategy-originated
  mandates, +CEO above threshold; CEO-originated mandates skip straight
  to active; a GM-originated mandate needing CEO sign-off skips GM's own
  and goes straight to CEO)
       ↓
Mandate activates - rental collection tracking begins
```

The `property_mandates` row is the *activation record* at the tail end of this sequence, not the whole sequence. Everything from Prospecting through Front Office formalization is BD/Front-Office departmental work that has **no built module yet** (`/admin/business-development/*` and `/admin/front-office/paperwork` do not exist in this codebase). Per the client's own instruction - build what's in scope, document the rest - this ADR draws the line explicitly at §14.4.

### 14.2 Role-based approval routing - the actual fix

**Decision:** The required approval tier is a function of *who is creating the mandate*, not a flat rule. Concretely, using each role's rank in the mandate-activation authority chain (`ceo` > `general_manager` > everyone else - `property_manager`, `head_of_strategy` (14.3), `rentals_mandates_officer`, or any other role holding the reused `properties.property.write` key):

- **CEO-originated:** no approval step at all. The mandate goes straight to `active` on creation, with an audit entry noting self-authorization. Nothing sits above the CEO in this system to approve on his behalf, and per the client, "everything stops at him."
- **GM-originated, within the GM tier** (≤10 units and ≤KES 5M annualized): same self-approval logic - a GM does not wait on another GM. Straight to `active`.
- **GM-originated, exceeding the CEO threshold** (>10 units or >KES 5M annualized): needs CEO approval only - not GM, since the GM *is* the requester. One `approval_requests` row, `requiredApproverRole = "ceo"`.
- **Everyone else (Property Manager, Head of Strategy, Rentals & Mandates Officer, ...):** always needs at least GM approval (mandate activation has no auto-approve tier for non-executive creators - Executive Dashboard spec §6.2's "always" column). One `approval_requests` row, `requiredApproverRole = "gm"`, or `"ceo"` if the unit/value threshold is additionally exceeded (GM's sign-off does not separately queue in that case - the CEO's approval is the higher bar and subsumes it, consistent with how every other threshold table in this system is a mutually-exclusive band, not a dual sign-off chain, except where a spec explicitly says "dual sign-off" - banker's cheques do, mandate activation does not).

This generalizes a pattern this codebase didn't have before ("does the actor's own authority already satisfy the approval this action would otherwise require") - scoped narrowly to mandate activation here per the client's explicit ask, not generalized into `authorize()`/`can()` itself. If other approval-gated flows (petty cash, cheques, vehicle requests) turn out to need the same self-approval-skip logic, that is a separate, later decision, not assumed by this ADR.

### 14.3 `head_of_strategy` - implementing what ADR 013 already decided

ADR 013 §13.1 specified `head_of_strategy` (global scope, reports to GM, owns Property Managers/Line Managers/Sales/Marketers) but it was never added to the `user_role` enum or `catalog.ts` - confirmed absent from both as of this ADR. Since the client's mandate-approval correction explicitly names this role ("we shall also do same for head of strategy"), implementing it is now load-bearing, not speculative. Implemented exactly as ADR 013 §13.1 specified: `...keysFor("crm")`, `...keysFor("properties")`, `...keysFor("scheduling")`, `...keysFor("operations")`, `identity.user.read`, `settings.entity.read`, `audit.log.read`, global scope. No other part of ADR 013 (Senior Accountant/Internal Auditor relabels, the 90-day finance-access gate, Admin/CEO's Assistant) is in scope here - those remain separately tracked against ADR 013 itself.

### 14.4 Landlord and property document verification

**Decision:** The CEO (or anyone with `properties.property.write`) can confirm a landlord's identity and review the documents backing a property/mandate directly from the property full-view page:

- `contacts` gains `idNumber` (text, nullable - national ID/passport number), `verifiedAt`/`verifiedById` (nullable - who confirmed this contact's identity and when). Generic to any contact, not landlord-specific, since the same verification concept applies to tenants and other counterparties later.
- The property full-view's Owner/Landlord rail card gets a "Confirm Landlord" action (gated the same as other write actions) that records/edits the ID number and sets `verifiedAt`/`verifiedById` in one step.
- Property documents (title deed, mandate letter, landlord ID) were already modelled (`documents.type` enum already had `mandate_letter`, `title_deed`, `identification` - this ADR adds `offer_letter` for vocabulary completeness) but two gaps existed: (a) `documents.type` was dropped when mapping to the frontend's `PropertyDocumentSummary`, so the full-view page couldn't distinguish a title deed from a mandate letter from anything else - fixed by threading `type` through; (b) landlord documents uploaded via the property form modal are saved scoped to `ownerContactId` only (no `propertyId` - deliberate, since one landlord's ID/title deed applies across all their properties), but `getPropertyWithDetails` only ever queried `documents` by `propertyId`, so those uploads were invisible on the full-view page they were meant to support. Fixed by additionally fetching the owner's documents.

This is intentionally *not* a KYC workflow with states, expiry, or re-verification reminders - it is a single confirm action, matching the size of what was actually asked for. A fuller compliance workflow is a later decision if the client asks for one.

### 14.5 What this ADR does not build - explicit deferral

Per the client's own framing ("if it is scope otherwise document it"), the following are real, specified, but **not built**, and not implied to be built by anything above:

- **BD Landlords page** (`/admin/business-development/landlords` - Directory, Mandate Status, Prospecting tabs) and **BD Liaison & Requests** (`/admin/business-development/liaison`) - `SUNLAND_BD_DASHBOARD_SPEC.md` §8.1/§8.4. No route, no schema beyond what `property_mandates`/`documents`/`contacts` already provide incidentally.
- **Front Office Paperwork module** (`/admin/front-office/paperwork` - Application Forms, Offer Letters, Mandate Letters tabs with their own Drafted→Sent→Signed/Returned→Filed lifecycle and cross-department Pusher events) - `SUNLAND_FRONT_OFFICE_DASHBOARD_SPEC.md` §8.4. Today, a mandate letter (or an offer letter, or a title deed) is just a row in the existing generic `documents` table with the right `type` - there is no dedicated formalization workflow, signature capture, or status ladder around it.
- **Prospecting stage tracking** (Initial Contact / Proposal Sent / Negotiating / Mandate Drafted) - no table exists for this; a mandate today either doesn't exist yet or exists as a `property_mandates` row starting at `pending_approval` (or `active` for self-approving creators). The pre-mandate courtship phase has no persisted record.
- **Finance's dedicated Mandates module** (`/fin/mandates`, `SUNLAND_FINANCE_DASHBOARD_SPEC.md`) remains the pre-existing mock board (unrelated to this ADR, already flagged as a follow-up rewire in the WS3 plan) - the CEO-admin property full-view is the practical interim surface for mandate creation/approval/termination until that page is rewired.

**Rationale & build detail:** `SUNLAND_ERP_IMPLEMENTATION_SPEC.md` §4.3, `SUNLAND_BACKEND_ARCHITECTURE_MASTER.md` (mandate letter flow cross-module summary), `SUNLAND_EXECUTIVE_DASHBOARD_SPEC.md` §6.2 (approval threshold table), `SUNLAND_BD_DASHBOARD_SPEC.md` §8.1/§8.4, `SUNLAND_FRONT_OFFICE_DASHBOARD_SPEC.md` §8.4, ADR 013 §13.1 (Head of Strategy).


