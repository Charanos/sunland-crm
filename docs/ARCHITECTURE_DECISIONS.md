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

## ADR 005: Routes Are Department-Scoped Under `/admin` — ⚠️ SUPERSEDED by ADR 009

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

## ADR 007: Landing Page Redirection and Access Emulation Profiles

To make local development, QA, and client review streamlined, the main landing page (`/`) redirects automatically to the secure `/login` route.
The login page contains an "Authorized Workspace Portals" switcher that emulates the six core client roles we are building out dashboards for:
1. CEO (`ceo` - Paul Amos)
2. General Manager (`general_manager` - Grace Mutua)
3. Head of Finance (`finance_head` - Dennis Munge)
4. Head of HR (`hr_head` - Cody Fisher)
5. Line Manager / Business Dev (`line_manager` - Jared Omondi)
6. Front Office Lead (`front_office_head` - Sharon Koech)

All emulated profiles are backed by real database users seeded in both `src/db/seed.ts` (CLI) and `src/app/api/auth/seed/route.ts` (API route) using the default password `sunland-demo` to preserve compatibility.

## ADR 008: Universal Self-Service Access Paths — ⚠️ SUPERSEDED by ADR 010
Common account modules (Profile, Settings, Security, Messages, Notifications) are hosted under the `/admin` path group but are whitelisted under `UNIVERSAL_PATHS` in [roles.ts](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/lib/auth/roles.ts). This ensures that any authenticated employee (e.g. Finance Officer, HR Head) can manage their personal profiles, preferences, and communications without triggering role-based redirects to their department's dashboard roots.

> **Superseded:** hosting self-service under a single `/admin` group is the root cause of the "in `/fin` but Profile routes to `/admin/profile`" defect — it drops users out of their portal shell. Replaced by portal-local self-service (ADR 010). The original is kept for history.

---

## ADR 009: Independent Portal Route Groups — supersedes ADR 005
**Decision:** Every role's dashboard is an independent Next.js route group with its own root and shell: `/exec` (CEO/GM), `/fin`, `/hr`, `/bd`, `/front`, `/ops`, and the external `/landlord` and `/tenant`. No department's functionality lives under another portal's root. The former model of hosting departments under `/admin/*` (ADR 005) is retired; `/admin` becomes — at most — just the executive portal's own root, never a catch-all others nest under.

**Why:** the code had already diverged from ADR 005 (Finance was fully built as an independent `(fin)/fin` group, not at `/admin/finance`), leaving HR/BD/Front-Office stranded under `/admin`. This ADR ratifies the direction the code took and mandates finishing it for every role. Independence is of *route + shell*; the system stays unified through shared data, the ledger, and the approval/notification engines — not shared routes.

**Rationale & build detail:** `docs/SUNLAND_DASHBOARD_PORTAL_ARCHITECTURE.md`.

---

## ADR 010: Portal-Local Self-Service — supersedes ADR 008
**Decision:** Profile, Settings, Security, Notifications, and Messages are rendered **within each portal's own shell**, from **shared components**, at portal-local routes (`/fin/profile`, `/hr/profile`, …). There is no global `/admin/profile`. `UNIVERSAL_PATHS` is removed; the self-service segments (`profile|settings|security|notifications|messages`) are simply permitted under any portal root the user can access. A `usePortalPrefix()` helper + `PortalContext` ensure shared components link within the active portal and never hardcode `/admin/*`.

**Why:** independence of route with unity of implementation — one `ProfilePage` component, rendered locally in every portal — fixes the cross-shell jump while avoiding duplicated code.

---

## ADR 011: Permission-Based, Two-Layer Authorization — extends ADR 004
**Decision:** Authorization is permission-based (`<module>.<resource>.<action>` keys in a `permissions`/`roles`/`role_permissions`/`user_roles` model), enforced at **two layers**: (1) an edge route guard (`proxy.ts`) that gates *which portals* a user may load, and (2) service-level `authorize(ctx, key)` that gates *which actions* a user may perform. Route-prefix gating alone (the current `roleAccess` map) is retired as the sole mechanism. The CEO super-admin holds every permission explicitly (seeded, data-driven — not a code-level bypass); the dev auth bypass no longer defaults to on.

**Why:** route gating cannot express "may view remittances but not approve them." Action-level checks inside the single service write path (ADR-002-adjacent) are the only place money-affecting authority can be enforced and audited.

**Rationale & build detail:** `docs/SUNLAND_BACKEND_ARCHITECTURE_MASTER.md` §3, `docs/SUNLAND_DASHBOARD_PORTAL_ARCHITECTURE.md` §5–6.

---

## ADR 012: CEO/System-Administration Is Real API Surface, Not Just a Data Model — extends ADR 011

**Decision:** Built ahead of P1, at the client's explicit direction to make CEO backend authority "the guide going forward." The permission model (ADR 011) is now backed by a full management surface: user CRUD (`/api/identity/users*`), role/permission CRUD (`/api/identity/roles*`, `/api/identity/permissions`), role-grant management (`/api/identity/users/[id]/roles`, `/api/identity/user-roles/[id]`), session listing/revocation (`/api/identity/sessions*`), entity settings/thresholds (`/api/settings`), and an audit-log explorer (`/api/audit`). Sessions are now genuinely revocable (a `sessions` row per login, checked on every `getCurrentUser()` call), not just a table sitting unused.

**Why:** a permission catalog that CEO holds every key of is oversight in name only until there's a real surface to exercise it through — grant/revoke roles, deactivate an account, kill a session, inspect the audit trail. This ADR makes that surface exist and pins down the rules future work must preserve:
1. **`isLastSuperAdmin()`** blocks deactivating or CEO-role-stripping the sole remaining active CEO. Checked inline in `updateUserAccess` and `revokeUserRole`, not layered on as an afterthought.
2. **System roles are immutable via the API.** All 16 real roles are `isSystem: true`; `seedPermissionCatalog()` fully replaces their `role_permissions` on every seed, so an API-side edit would silently vanish. Only custom (non-system) roles can be edited/deleted through the API.
3. **Department heads are global-scope, officers are entity-scope.** Caught live, not designed upfront: `finance_head`/`hr_head`/`front_office_head` must be `scopeType: "global"` (matching the seed data's own choice of `primaryEntityId = group` for heads vs. a specific entity for officers), or a department head scoped only to "Group" cannot act on a resource belonging to any other entity.
4. **No email service exists**, so `createUser` returns a one-time plaintext temporary password in its response rather than building a speculative invite/reset-token flow nothing else needs yet.

**Rationale & build detail:** `docs/SUNLAND_BACKEND_ARCHITECTURE_MASTER.md` §3.4, `docs/SUNLAND_DASHBOARD_PORTAL_ARCHITECTURE.md` §6.


