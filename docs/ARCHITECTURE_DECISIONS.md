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

## ADR 005: Routes Are Department-Scoped Under `/admin`

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

## ADR 008: Universal Self-Service Access Paths
Common account modules (Profile, Settings, Security, Messages, Notifications) are hosted under the `/admin` path group but are whitelisted under `UNIVERSAL_PATHS` in [roles.ts](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/lib/auth/roles.ts). This ensures that any authenticated employee (e.g. Finance Officer, HR Head) can manage their personal profiles, preferences, and communications without triggering role-based redirects to their department's dashboard roots.


