# Sunland Real Estates — CRM Implementation Specification

**Sunland CRM · Estate Intelligence Platform · Internal Operations**

> This is the primary source of truth for building the Sunland Real Estates internal CRM. It covers
> identity, design system, data architecture, RBAC, module structure, component patterns, real-time
> strategy, and implementation sequence. The goal is a premium, dense, operationally serious platform
> that reflects the professionalism of the Sunland brand — not a generic SaaS clone.
>
> **Design authority:** The Terrain Identity design system (Sections 3–7) governs all UI decisions.
> **Data authority:** Section 8 governs schema direction and ORM conventions.
> **Auth authority:** Section 9 governs RBAC, roles, and session management.
>
> Last updated: June 2026
>
> **Implementation update:** The product name in code and UI is now **Sunland CRM**. The original
> "Meridian" naming is retired for the application shell. The active visual system uses a dark
> command sidebar, light operational workspace, and **Sunland Yellow** as the primary accent instead
> of green. Route protection uses Next.js `proxy.ts`, not `middleware.ts`.

---

## Contents

1. [Project Identity & Philosophy](#1-project-identity--philosophy)
2. [Tech Stack](#2-tech-stack)
3. [Terrain Identity — Design Tokens](#3-terrain-identity--design-tokens)
4. [Typography System](#4-typography-system)
5. [Surface & Depth Model](#5-surface--depth-model)
6. [Spacing, Layout & Grid](#6-spacing-layout--grid)
7. [Animation & Motion](#7-animation--motion)
8. [Data Architecture](#8-data-architecture)
9. [Auth & RBAC](#9-auth--rbac)
10. [Module Map — Routes](#10-module-map--routes)
11. [Component System](#11-component-system)
12. [Real-time Strategy](#12-real-time-strategy)
13. [Caching Strategy](#13-caching-strategy)
14. [State Management](#14-state-management)
15. [UI/UX Standards](#15-uiux-standards)
16. [Implementation Sequence](#16-implementation-sequence)
17. [Quality Gates](#17-quality-gates)
18. [Mock Data Contract](#18-mock-data-contract)

---

## 1. Project Identity & Philosophy

### What This Is

Sunland CRM is Sunland Real Estates' private operating system. It is not a portal. It is not a public-facing tool. It is the command layer through which every piece of business intelligence, every pipeline stage, every lease, every commission, and every contact in Sunland's world becomes legible and actionable to the right person at the right time.

The CEO sees the entire business in one surface. The agent sees their pipeline and nothing more. The accounts officer processes rent and flags arrears. Every role has a deliberate, minimal surface — not because the system is limited, but because operational clarity is the product.

### What This Is Not

Sunland CRM is not a generic real estate listing platform. It is not customer-facing. It is not a WordPress rebuild. The UI aesthetics are dense, command-center, data-forward, and operational, but the metaphor is Kenyan land and commerce, not cosmic space. Warm, grounded, authoritative.

### Design Metaphor — The Estate

Sunland's tagline is "Where Life Meets Style." Their work is physical: land, concrete, glass, steel, the Nairobi skyline, and the quiet of Karen. The internal CRM should carry that weight. The palette is grounded but not generic: a dark command sidebar, warm light workspace surfaces, Sunland Yellow for primary action, restrained green for success/estate context, and cobalt for data/status.

Sunland CRM is architectural and grounded. It should feel premium without becoming decorative or generic.

### North Star Questions (Per Page)

Every page and component in Sunland CRM must answer:

1. Who is this user and what is their active job right now?
2. What is the single next meaningful action on this screen?
3. What changed since they last logged in?
4. What data is live and trusted vs. pending?
5. What is appropriately empty — and what does that emptiness mean?

---

## 2. Tech Stack

### Decision Rationale

| Layer | Technology | Decision | Why |
|---|---|---|---|
| Framework | Next.js App Router | Confirmed | SSR/SSG flexibility, server actions, route groups for role isolation |
| Language | TypeScript | Confirmed | End-to-end type safety across schema, server, and client |
| Styling | Tailwind CSS v4 | Confirmed | Token-first, utility composition, no arbitrary value sprawl |
| Animation | Framer Motion | Confirmed | Spring physics, layout animations, drawer/modal transitions |
| **Database** | **PostgreSQL via Neon** | **Chosen** | Real estate data is deeply relational — properties, tenants, leases, contacts, commissions, maintenance records, financial transactions all have foreign-key relationships that need ACID guarantees and complex join performance. MongoDB's document model would introduce structural ambiguity across entities that genuinely belong in normalized tables. |
| **ORM** | **Drizzle ORM** | **Chosen** | Lightweight, TypeScript-native, excellent migration DX, zero runtime overhead, consistent with Jordan's Andishi stack. Prisma's abstraction layer adds unnecessary latency at query generation time for this class of operational queries. |
| Auth | Custom JWT via `jose` | Confirmed | No third-party auth dependency, full session control, consistent with Andishi |
| Forms | React Hook Form + Zod | Confirmed | Schema-driven validation, minimal re-render footprint |
| Charts | Recharts | Confirmed | Declarative, composable, performant at the dashboard data volumes here |
| **Real-time** | **Ably (WebSockets)** | **Chosen** | Lead status push, payment alerts, maintenance updates. Ably's managed WebSocket infrastructure avoids the operational overhead of self-hosting a Socket.IO server on Vercel's serverless environment. An SSE fallback handles read-only notification streams where connection persistence isn't critical. |
| **Caching** | **Upstash Redis** | **Chosen** | Serverless-native Redis. Dashboard KPI aggregations and property listing counts are expensive queries that don't need to be recalculated on every page load. Upstash's HTTP-based Redis client works natively in Vercel's edge/serverless environment. |
| **State** | **Zustand + TanStack Query** | **Chosen** | Zustand for UI ephemeral state (sidebar open, active filters, selected record IDs). TanStack Query for all server-derived state with smart cache invalidation, optimistic updates, and background refetch. |
| Icons | `@tabler/icons-react` | Confirmed | Consistent with Jordan's established icon language |
| Deployment | Vercel | Confirmed | Optimal Next.js App Router deployment target |
| File Storage | Cloudinary | Chosen | Property images, valuation reports, lease document previews |

### Package Baseline

```bash
# Core
next@latest
typescript
tailwindcss@v4
framer-motion
drizzle-orm
drizzle-kit
@neondatabase/serverless
jose

# Forms & Validation
react-hook-form
@hookform/resolvers
zod

# Data & State
@tanstack/react-query
zustand
recharts
@tabler/icons-react

# Real-time & Cache
ably
@upstash/redis

# File Handling
next-cloudinary

# Dev utilities
cn (clsx + tailwind-merge)
date-fns
```

---

## 3. Terrain Identity — Design Tokens

### Philosophy

The Terrain Identity is Sunland CRM's visual language. It is not a copied SaaS theme — it's a separate system with the same discipline: CSS variables everywhere, no hardcoded hex in components, semantic color semantics, and restrained typography.

The palette is built around three axes:
- **Sunland Yellow** — the primary accent. Buttons, active rail markers, selection states, and the most important action affordances live here.
- **Estate Green** — the success/estate accent. Trust, land, confirmed actions, occupancy, and healthy operational states.
- **Cobalt** — the data accent. Analytics charts, pipeline stage counts, system statuses.

### CSS Custom Properties (`globals.css`)

```css
:root {
  /* ── Backgrounds ─────────────────────────────── */
  --bg:             #0B1210;   /* deep forest-slate, warmly dark */
  --bg-deep:        #090F0D;   /* deepest layer, behind art elements */
  --surface-low:    #131C19;   /* subtle section separators */
  --surface:        #192420;   /* default card base */
  --surface-high:   #21302B;   /* elevated cards, hover */
  --surface-highest: #293C35;  /* modals, tooltips, command layer */
  --surface-bright: #334740;   /* active tabs, selected rows */

  /* ── Text ────────────────────────────────────── */
  --on-surface:     #E4EDE9;   /* primary text — warm off-white */
  --on-surface-dim: #A8BDB5;   /* labels, captions, secondary */
  --inverse-surface: #E4EDE9;
  --inverse-on-surface: #1E2E29;

  /* ── Primary — Sunland Yellow ────────────────── */
  --primary:              #F3DF27;  /* primary actions, active rail markers */
  --on-primary:           #181500;
  --primary-container:    #F8EB62;  /* button hover, active pills */
  --on-primary-container: #181500;
  --primary-fixed:        #FFF4A8;
  --primary-fixed-dim:    #F3DF27;
  --inverse-primary:      #8D7B00;  /* rare light-surface contrast */

  /* ── Secondary — Sunland Amber ───────────────── */
  --secondary:              #E9A825;  /* amber signal — money, transactions */
  --on-secondary:           #3D2800;
  --secondary-container:    #C48A0A;
  --on-secondary-container: #301F00;
  --secondary-fixed:        #FFE5A0;
  --secondary-fixed-dim:    #E9A825;

  /* ── Tertiary — Cobalt ───────────────────────── */
  --tertiary:               #5CAFF0;  /* data, analytics, system status */
  --on-tertiary:            #003256;
  --tertiary-container:     #2E89CC;
  --on-tertiary-container:  #002844;

  /* ── Structural ──────────────────────────────── */
  --outline:         #6B8A7E;  /* focused borders */
  --outline-variant: #2E4040;  /* default card borders */
  --surface-tint:    #F3DF27;

  /* ── Error / Risk ────────────────────────────── */
  --error:           #FF8A7A;
  --error-container: #8A1C0E;
  --on-error-container: #FFDAD3;

  /* ── Success / Confirmed ─────────────────────── */
  --success:         #52B788;
  --success-container: #1A5C3C;

  /* ── Semantic CRM Accents ────────────────────── */
  /* These align with pipeline stages and record types */
  --lead:       var(--tertiary);     /* new lead, inquiry */
  --active:     var(--primary);      /* active/in-progress */
  --transact:   var(--secondary);    /* financial, commission, sale */
  --risk:       var(--error);        /* arrears, overdue, maintenance critical */
  --complete:   var(--success);      /* closed, placed, paid */
  --vacant:     var(--on-surface-dim); /* empty unit, no tenant */
}
```

### Semantic Color Usage

| Token | Where |
|---|---|
| `--bg` | Page background |
| `--bg-deep` | Behind decorative art layers |
| `--surface` | Default glass card, table rows |
| `--surface-high` | Hovered/selected states |
| `--surface-highest` | Modals, command palette, tooltips |
| `--primary` | Links, active states, CTA highlights, pipeline progress |
| `--primary-container` | Button fills, active tab backgrounds |
| `--secondary` | All financial figures — KES values, commissions, revenue KPIs |
| `--tertiary` | System status indicators, chart fills, stage counts |
| `--lead` | Lead stage in pipeline |
| `--transact` | Sale, commission, invoice events |
| `--risk` | Arrears, overdue maintenance, lease near-expiry |
| `--complete` | Closed deals, paid invoices, resolved maintenance |
| `--outline-variant` | Default card borders |
| `--outline` | Active/focused borders |

### Glass Card Formula (Tailwind v4)

```
Card base:        bg-white/[0.035]
Card border:      border border-white/[0.07]
Active glow:      shadow-[0_0_0_1px_rgba(126,200,164,0.2)]
Amber glow:       shadow-[0_0_0_1px_rgba(233,168,37,0.2)]
Blur:             backdrop-blur-xl (24px)
Hover:            bg-white/[0.055] border-white/[0.12]
```

Note: Single glass depth only. No nested glass cards. A glass card does not contain another glass card.

---

## 4. Typography System

### Font Stack

Identical discipline to Andishi. The font families differ in loading only; the weight and usage rules are identical.

```css
@import url("https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap");
```

For Cormorant Garamond (`title-serif`): Sunland is a real estate company. Serif headlines for section titles add gravitas appropriate to property, land, and leasing — similar to how premium estate agents print their materials. Use it sparingly.

```css
@import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&display=swap");
```

### Type Scale

```css
/* Page and section headers */
.title-serif {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(28px, 3vw, 40px);
  font-weight: 300;
  font-style: italic;
  line-height: 1.15;
  letter-spacing: -0.01em;
}

/* Dashboard page headings */
.headline-lg {
  font-family: 'Outfit', sans-serif;
  font-size: clamp(22px, 2.5vw, 30px);
  font-weight: 400;
  line-height: 1.2;
  letter-spacing: -0.015em;
}

/* Section headings, drawer titles */
.headline-md {
  font-family: 'Outfit', sans-serif;
  font-size: 18px;
  font-weight: 400;
  line-height: 1.3;
}

/* Body and card content */
.body-md {
  font-family: 'Outfit', sans-serif;
  font-size: 15px;
  font-weight: 400;
  line-height: 1.6;
}

/* Small labels, table headers */
.body-sm {
  font-family: 'Outfit', sans-serif;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
}

/* Caps labels, nav items, eyebrows */
.label-caps {
  font-family: 'Outfit', sans-serif;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

/* All numeric/financial values */
.mono-stat {
  font-family: 'JetBrains Mono', monospace;
  font-size: clamp(24px, 2.5vw, 40px);
  font-weight: 400;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

/* Table numeric data, IDs, dates */
.mono-data {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0.01em;
}

/* KES amounts inline */
.mono-amount {
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.01em;
}
```

### Typography Hard Rules

- **Zero tolerance for `font-bold` (700) or `font-semibold` (600) anywhere in the codebase.** Scale, color, and spacing carry hierarchy — not weight.
- Weight 300 for italic serif headers only.
- Weight 400 for all Outfit body, headlines, and descriptions.
- Weight 500 for labels, nav items, caps tags, and `mono-amount` only.
- JetBrains Mono for: KES amounts, percentages, property IDs, tenant IDs, sq ft values, lease terms, dates in data tables, stat figures.
- `cn()` for all className composition. Never string-concatenate class lists.
- `aria-label` attributes on all icon-only controls.

---

## 5. Surface & Depth Model

Five Z-levels. Terrain uses warmer surface tints reflecting the green-slate color system.

```
Level 0 — Ground Layer
  z-index:  0
  bg:       var(--bg-deep)
  Use:      Page background canvas, decorative map/terrain art overlays

Level 1 — Terrain Plane
  z-index:  1
  bg:       rgba(255,255,255,0.015)
  blur:     backdrop-blur-[60px]
  border:   1px solid rgba(255,255,255,0.035)
  Use:      Section structural overlays, module zone separators

Level 2 — Active Cards (default)
  z-index:  2
  bg:       rgba(255,255,255,0.035)
  blur:     backdrop-blur-xl (24px)
  border:   1px solid rgba(255,255,255,0.07)
  shadow:   inset 0 1px 0 rgba(255,255,255,0.06)
  Use:      KPI cards, table rows, contact cards, property cards, timeline items

Level 3 — Elevated / Hover
  z-index:  3
  bg:       rgba(255,255,255,0.06)
  blur:     backdrop-blur-2xl (40px)
  border:   1px solid rgba(126,200,164,0.18)
  Use:      Hovered cards, selected row highlights, featured properties

Level 4 — Interaction Layer
  z-index:  100
  bg:       rgba(25,36,32,0.97)
  blur:     backdrop-blur-2xl
  border:   1px solid rgba(126,200,164,0.25)
  Use:      Drawers, modals, command palette, dropdown menus, toasts
```

### Accent Border System

Left-border accent cards are the standard pattern for entity list items (contacts, properties, leases, leads). Same pattern as Andishi's `absolute inset-y-0 left-0 w-[3px]`.

```
Lead record:      --lead (cobalt)
Active lease:     --primary (green)
Financial entry:  --secondary (amber)
Overdue/risk:     --risk (red)
Completed/closed: --complete (soft green)
```

---

## 6. Spacing, Layout & Grid

### Spacing Base

```
8px base unit. All spacing is multiples.

space-1:   8px   ← icon-label gap, tight inline
space-2:  16px   ← card internal element gap
space-3:  24px   ← card padding (compact), between table rows
space-4:  32px   ← card padding (standard)
space-5:  40px
space-6:  48px   ← section internal gap
space-8:  64px   ← between major sections
space-10: 80px
space-16: 128px  ← section gap (page level)
```

### Grid

- 12-column grid, `max-w-[88rem]` (wider than Andishi's 92rem for denser data layouts)
- Responsive gutters: `px-4 sm:px-6 lg:px-8`
- Dashboard shell: fixed left sidebar (240px desktop, 64px collapsed rail, full-screen mobile drawer)
- Main content area fills remaining width
- Most dashboard grid layouts: 12-col split across `grid-cols-12` with `col-span-8` primary content + `col-span-4` command rail
- Table views: full `col-span-12`
- KPI strips: `grid-cols-2 sm:grid-cols-4` with equal-weight cells

### Corner Radius

```
card:    0.75rem (12px)  ← standard glass cards
input:   0.5rem  (8px)
badge:   9999px          ← pill badges only
button:  0.5rem  (8px)   ← rectangular buttons, not pill (except secondary ghost)
drawer:  1rem    (16px)  ← left/right sliding panels
modal:   1rem    (16px)
```

---

## 7. Animation & Motion

All motion uses Framer Motion spring physics. No `easeOut` cubic bezier defaults.

### Spring Configs

```ts
// Standard interaction spring
const spring = { type: "spring", stiffness: 380, damping: 30 };

// Drawer/panel entrance (heavier, settles more)
const drawerSpring = { type: "spring", stiffness: 260, damping: 28 };

// Micro-interaction (badge, indicator pulse)
const microSpring = { type: "spring", stiffness: 500, damping: 35 };

// Staggered list entrance
const stagger = { staggerChildren: 0.04, delayChildren: 0.1 };
```

### Standard Entrance Patterns

```ts
// KPI card entrance
const cardVariant = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: spring }
};

// Table row stagger
const rowVariant = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 }
};

// Drawer slide-in from right
const drawerVariant = {
  hidden: { x: "100%", opacity: 0 },
  visible: { x: 0, opacity: 1, transition: drawerSpring },
  exit: { x: "100%", opacity: 0, transition: { duration: 0.2 } }
};
```

### Motion Rules

- Respect `prefers-reduced-motion`. Wrap any decorative animations in a `useReducedMotion()` check.
- Page transitions: `opacity` fade only (100ms). No slide-between-pages.
- Hover on cards: `translateY(-2px)` with `transition-all duration-200`.
- Toast entry: slide up + fade, exit: fade. Duration 300ms.
- Skeleton pulse: CSS `animate-pulse` is acceptable for skeleton loaders only. Not for ambient effects.
- No looping ambient animations. No spinning orbs. This is a business tool.

---

## 8. Data Architecture

### Database Choice — PostgreSQL (Neon)

Real estate CRM data is fundamentally relational. Contacts own properties. Leases connect contacts to properties with financial terms. Maintenance requests belong to units within properties. Commissions are derived from transactions with split rules. None of this fits naturally in a document model. PostgreSQL's JOIN performance, foreign key integrity, and ACID transactions are not optional for financial data.

Use Neon for serverless Postgres with connection pooling via `@neondatabase/serverless`.

### ORM — Drizzle

Use Drizzle ORM with the `drizzle-kit` migration toolchain. Define schemas in `/src/db/schema/` as separate files per domain.

### Schema Overview

This is directional, not exhaustive. The implementation should derive final column shapes from the business rules in the client document.

#### `users` — Authentication & Identity

```ts
// src/db/schema/users.ts
export const users = pgTable('users', {
  id:           uuid('id').defaultRandom().primaryKey(),
  email:        varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name:         varchar('name', { length: 255 }).notNull(),
  role:         userRoleEnum('role').notNull(),
  department:   departmentEnum('department'),
  status:       userStatusEnum('status').default('active'),
  avatarUrl:    text('avatar_url'),
  phone:        varchar('phone', { length: 30 }),
  lastLoginAt:  timestamp('last_login_at', { withTimezone: true }),
  createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const userRoleEnum = pgEnum('user_role', [
  'ceo', 'gm', 'bd_head', 'agent',
  'property_manager', 'accounts_manager', 'accounts_officer',
  'auditor', 'hr_manager', 'pa', 'internal_auditor'
]);

export const departmentEnum = pgEnum('department', [
  'executive', 'business_development', 'property_management',
  'finance', 'client_success', 'operations', 'hr'
]);

export const userStatusEnum = pgEnum('user_status', [
  'active', 'invited', 'suspended', 'disabled'
]);
```

#### `contacts` — CRM Core Contact Entity

```ts
// src/db/schema/contacts.ts
export const contacts = pgTable('contacts', {
  id:           uuid('id').defaultRandom().primaryKey(),
  type:         contactTypeEnum('type').notNull(),
  firstName:    varchar('first_name', { length: 100 }).notNull(),
  lastName:     varchar('last_name', { length: 100 }),
  company:      varchar('company', { length: 255 }),
  email:        varchar('email', { length: 255 }),
  phone:        varchar('phone', { length: 30 }),
  phone2:       varchar('phone_2', { length: 30 }),
  nationalId:   varchar('national_id', { length: 20 }),
  kraPin:       varchar('kra_pin', { length: 20 }),
  location:     varchar('location', { length: 255 }),
  source:       contactSourceEnum('source'),
  assignedToId: uuid('assigned_to_id').references(() => users.id),
  notes:        text('notes'),
  tags:         text('tags').array(),
  status:       contactStatusEnum('status').default('active'),
  createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const contactTypeEnum = pgEnum('contact_type', [
  'landlord', 'property_owner', 'investor', 'buyer',
  'tenant', 'developer', 'financial_institution',
  'advocate', 'contractor', 'valuer', 'government_agency'
]);

export const contactSourceEnum = pgEnum('contact_source', [
  'referral', 'walk_in', 'website', 'social_media',
  'cold_call', 'existing_client', 'partner', 'exhibition'
]);

export const contactStatusEnum = pgEnum('contact_status', [
  'active', 'inactive', 'blacklisted'
]);
```

#### `properties` — Property Database

```ts
// src/db/schema/properties.ts
export const properties = pgTable('properties', {
  id:               uuid('id').defaultRandom().primaryKey(),
  title:            varchar('title', { length: 255 }).notNull(),
  type:             propertyTypeEnum('type').notNull(),
  status:           propertyStatusEnum('status').notNull(),
  listingType:      listingTypeEnum('listing_type').notNull(),
  location:         varchar('location', { length: 255 }),
  county:           varchar('county', { length: 100 }),
  subLocation:      varchar('sub_location', { length: 100 }),
  sizeValue:        numeric('size_value', { precision: 12, scale: 2 }),
  sizeUnit:         sizeUnitEnum('size_unit'),
  bedrooms:         integer('bedrooms'),
  bathrooms:        integer('bathrooms'),
  askingPrice:      numeric('asking_price', { precision: 15, scale: 2 }),
  rentPerMonth:     numeric('rent_per_month', { precision: 12, scale: 2 }),
  serviceCharge:    numeric('service_charge', { precision: 12, scale: 2 }),
  ownerId:          uuid('owner_id').references(() => contacts.id),
  managedById:      uuid('managed_by_id').references(() => users.id),
  mandateType:      mandateTypeEnum('mandate_type'),
  mandateStart:     date('mandate_start'),
  mandateEnd:       date('mandate_end'),
  description:      text('description'),
  features:         text('features').array(),
  imageUrls:        text('image_urls').array(),
  documentUrls:     text('document_urls').array(),
  isPublished:      boolean('is_published').default(false),
  createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const propertyTypeEnum = pgEnum('property_type', [
  'residential', 'commercial', 'industrial', 'land', 'villa', 'apartment', 'penthouse'
]);

export const propertyStatusEnum = pgEnum('property_status', [
  'available', 'under_offer', 'let', 'sold', 'off_market', 'managed'
]);

export const listingTypeEnum = pgEnum('listing_type', [
  'for_sale', 'to_let', 'managed', 'land_bank', 'investor_opportunity'
]);

export const mandateTypeEnum = pgEnum('mandate_type', [
  'exclusive', 'open', 'joint'
]);

export const sizeUnitEnum = pgEnum('size_unit', [
  'sqft', 'sqm', 'acres', 'hectares'
]);
```

#### `leads` — BD Pipeline

```ts
// src/db/schema/leads.ts
// CRM Pipeline: Lead → Prospect → Viewing → Offer → Negotiation → Sale/Lease
export const leads = pgTable('leads', {
  id:            uuid('id').defaultRandom().primaryKey(),
  type:          leadTypeEnum('type').notNull(),  // sale | lease | land | valuation | management
  stage:         pipelineStageEnum('stage').notNull().default('lead'),
  contactId:     uuid('contact_id').references(() => contacts.id).notNull(),
  propertyId:    uuid('property_id').references(() => properties.id),
  assignedToId:  uuid('assigned_to_id').references(() => users.id),
  expectedValue: numeric('expected_value', { precision: 15, scale: 2 }),
  currency:      varchar('currency', { length: 3 }).default('KES'),
  probability:   integer('probability'),          // 0-100
  viewingDate:   timestamp('viewing_date', { withTimezone: true }),
  expectedClose: date('expected_close'),
  source:        contactSourceEnum('source'),
  notes:         text('notes'),
  lostReason:    text('lost_reason'),
  stageHistory:  jsonb('stage_history'),          // [{stage, changedAt, changedBy, note}]
  createdAt:     timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const pipelineStageEnum = pgEnum('pipeline_stage', [
  'lead', 'prospect', 'viewing', 'offer', 'negotiation', 'closed_won', 'closed_lost'
]);

export const leadTypeEnum = pgEnum('lead_type', [
  'sale', 'lease', 'land_sale', 'land_acquisition', 'valuation',
  'management_mandate', 'investment_advisory'
]);
```

#### `leases` — Lease Management

```ts
// src/db/schema/leases.ts
export const leases = pgTable('leases', {
  id:              uuid('id').defaultRandom().primaryKey(),
  propertyId:      uuid('property_id').references(() => properties.id).notNull(),
  tenantId:        uuid('tenant_id').references(() => contacts.id).notNull(),
  landlordId:      uuid('landlord_id').references(() => contacts.id).notNull(),
  managedById:     uuid('managed_by_id').references(() => users.id),
  leaseType:       leaseTypeEnum('lease_type').notNull(),
  status:          leaseStatusEnum('status').notNull().default('active'),
  startDate:       date('start_date').notNull(),
  endDate:         date('end_date').notNull(),
  rentAmount:      numeric('rent_amount', { precision: 12, scale: 2 }).notNull(),
  serviceCharge:   numeric('service_charge', { precision: 12, scale: 2 }),
  depositAmount:   numeric('deposit_amount', { precision: 12, scale: 2 }),
  depositHeld:     boolean('deposit_held').default(true),
  paymentDay:      integer('payment_day').default(1),   // day of month
  escalationRate:  numeric('escalation_rate', { precision: 5, scale: 2 }),  // % per annum
  noticePeriodDays: integer('notice_period_days').default(30),
  documentUrl:     text('document_url'),
  notes:           text('notes'),
  renewalRemindAt: date('renewal_remind_at'),
  createdAt:       timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const leaseTypeEnum = pgEnum('lease_type', [
  'residential', 'commercial', 'office', 'retail', 'warehouse', 'industrial'
]);

export const leaseStatusEnum = pgEnum('lease_status', [
  'active', 'expired', 'terminated', 'under_renewal', 'notice_given'
]);
```

#### `transactions` — Financial Records

```ts
// src/db/schema/transactions.ts
export const transactions = pgTable('transactions', {
  id:            uuid('id').defaultRandom().primaryKey(),
  type:          transactionTypeEnum('type').notNull(),
  status:        transactionStatusEnum('status').notNull().default('pending'),
  leaseId:       uuid('lease_id').references(() => leases.id),
  contactId:     uuid('contact_id').references(() => contacts.id),
  propertyId:    uuid('property_id').references(() => properties.id),
  leadId:        uuid('lead_id').references(() => leads.id),
  amount:        numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currency:      varchar('currency', { length: 3 }).default('KES'),
  dueDate:       date('due_date'),
  paidDate:      date('paid_date'),
  reference:     varchar('reference', { length: 100 }),
  paymentMethod: paymentMethodEnum('payment_method'),
  receiptUrl:    text('receipt_url'),
  notes:         text('notes'),
  recordedById:  uuid('recorded_by_id').references(() => users.id),
  createdAt:     timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const transactionTypeEnum = pgEnum('transaction_type', [
  'rent', 'service_charge', 'deposit', 'commission_sale',
  'commission_lease', 'valuation_fee', 'advisory_fee',
  'management_fee', 'maintenance_cost', 'legal_fee', 'other'
]);

export const transactionStatusEnum = pgEnum('transaction_status', [
  'pending', 'paid', 'partial', 'overdue', 'waived', 'disputed'
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'mpesa', 'bank_transfer', 'cheque', 'cash', 'rtgs'
]);
```

#### `maintenance` — Maintenance & Facilities

```ts
// src/db/schema/maintenance.ts
export const maintenanceRequests = pgTable('maintenance_requests', {
  id:            uuid('id').defaultRandom().primaryKey(),
  propertyId:    uuid('property_id').references(() => properties.id).notNull(),
  leaseId:       uuid('lease_id').references(() => leases.id),
  reportedById:  uuid('reported_by_id').references(() => contacts.id),
  assignedToId:  uuid('assigned_to_id').references(() => users.id),
  contractorId:  uuid('contractor_id').references(() => contacts.id),
  category:      maintenanceCategoryEnum('category').notNull(),
  priority:      maintenancePriorityEnum('priority').notNull().default('normal'),
  status:        maintenanceStatusEnum('status').notNull().default('open'),
  description:   text('description').notNull(),
  estimatedCost: numeric('estimated_cost', { precision: 10, scale: 2 }),
  actualCost:    numeric('actual_cost', { precision: 10, scale: 2 }),
  scheduledDate: date('scheduled_date'),
  completedDate: date('completed_date'),
  imageUrls:     text('image_urls').array(),
  notes:         text('notes'),
  createdAt:     timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
```

#### `valuations` — Valuation Tracker (Sunland Valuers Ltd)

```ts
// src/db/schema/valuations.ts
export const valuations = pgTable('valuations', {
  id:              uuid('id').defaultRandom().primaryKey(),
  propertyId:      uuid('property_id').references(() => properties.id),
  clientId:        uuid('client_id').references(() => contacts.id).notNull(),
  assignedToId:    uuid('assigned_to_id').references(() => users.id),
  type:            valuationTypeEnum('type').notNull(),
  status:          valuationStatusEnum('status').notNull().default('instruction_received'),
  instructionDate: date('instruction_date'),
  inspectionDate:  date('inspection_date'),
  reportDate:      date('report_date'),
  deliveryDate:    date('delivery_date'),
  marketValue:     numeric('market_value', { precision: 15, scale: 2 }),
  fee:             numeric('fee', { precision: 10, scale: 2 }),
  feeStatus:       transactionStatusEnum('fee_status'),
  reportUrl:       text('report_url'),
  notes:           text('notes'),
  createdAt:       timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const valuationTypeEnum = pgEnum('valuation_type', [
  'market', 'mortgage', 'insurance', 'rental_assessment',
  'development', 'asset'
]);

export const valuationStatusEnum = pgEnum('valuation_status', [
  'instruction_received', 'inspection_scheduled', 'inspection_done',
  'report_preparation', 'report_delivered', 'fee_collected', 'complete'
]);
```

#### `activities` — Audit Trail & Event Log

```ts
// src/db/schema/activities.ts
export const activities = pgTable('activities', {
  id:          uuid('id').defaultRandom().primaryKey(),
  userId:      uuid('user_id').references(() => users.id),
  entityType:  varchar('entity_type', { length: 50 }),  // 'contact' | 'lead' | 'property' | 'lease' etc.
  entityId:    uuid('entity_id'),
  type:        activityTypeEnum('type').notNull(),
  summary:     text('summary').notNull(),
  metadata:    jsonb('metadata'),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const activityTypeEnum = pgEnum('activity_type', [
  'call', 'email', 'meeting', 'viewing', 'note', 'stage_change',
  'payment', 'document', 'maintenance', 'system'
]);
```

### Additional Tables (directional, not exhaustive)

- `commissions` — commission splits per agent/team for a closed deal
- `staff` — HR records: contracts, leave, performance (separate from `users` auth table)
- `tasks` — reminders and follow-up tasks linked to contacts/leads
- `documents` — document storage metadata (lease agreements, ID copies, KRA docs)
- `notifications` — system notification log per user
- `settings` — key-value store for system configuration

### Drizzle File Layout

```
src/db/
  index.ts          ← Drizzle client instantiation
  schema/
    users.ts
    contacts.ts
    properties.ts
    leads.ts
    leases.ts
    transactions.ts
    maintenance.ts
    valuations.ts
    activities.ts
    commissions.ts
    staff.ts
    tasks.ts
    documents.ts
    notifications.ts
    settings.ts
  migrations/
    ...             ← generated by drizzle-kit
```

---

## 9. Auth & RBAC

### Role Model

```ts
export type UserRole =
  | 'ceo'              // Super admin. Full read/write everywhere. Special CEO dashboard.
  | 'gm'               // General Manager / Commercial Manager. Operational full access.
  | 'internal_auditor' // Read-only. Access to all analytics and finance. No write.
  | 'bd_head'          // Business Development head. Manages the full pipeline + agents.
  | 'agent'            // Sales/leasing agent. Own pipeline, assigned contacts, own targets.
  | 'property_manager' // Manages assigned properties: tenants, maintenance, rent collection.
  | 'accounts_manager' // Full finance module. Revenue, invoicing, commissions, reconciliation.
  | 'accounts_officer' // Finance input level. Can record payments, not approve or export.
  | 'hr_manager'       // Full HR module. Staff records, leave, payroll coordination.
  | 'pa';              // PA/Secretary. Calendar, tasks, limited pipeline view. Read-mostly.
```

### Permission Matrix

| Module | CEO | GM | Auditor | BD Head | Agent | Prop Mgr | Accts Mgr | Accts Off | HR | PA |
|---|---|---|---|---|---|---|---|---|---|---|
| Executive Dashboard | ✓ | ✓ | R | — | — | — | R | — | — | — |
| Contacts | ✓ | ✓ | R | ✓ | Own | R | R | — | — | R |
| Properties | ✓ | ✓ | R | ✓ | ✓ | Assigned | R | — | — | R |
| BD Pipeline | ✓ | ✓ | R | ✓ | Own | — | R | — | — | R |
| Leases | ✓ | ✓ | R | R | R | Assigned | ✓ | R | — | — |
| Property Mgmt | ✓ | ✓ | R | — | — | ✓ | R | — | — | — |
| Maintenance | ✓ | ✓ | R | — | — | ✓ | R | R | — | — |
| Finance | ✓ | ✓ | R | R | R | R | ✓ | Input | — | — |
| Valuations | ✓ | ✓ | R | ✓ | — | — | R | — | — | — |
| HR | ✓ | ✓ | — | — | — | — | — | — | ✓ | — |
| Reports | ✓ | ✓ | R | ✓ | Own | Own | ✓ | — | ✓ | — |
| Settings | ✓ | ✓ | — | — | — | — | — | — | — | — |
| User Mgmt | ✓ | Limited | — | — | — | — | — | — | — | — |

`✓` = full CRUD, `R` = read-only, `Own` = only own records, `Input` = create/edit only (no delete/export), `—` = no access

### Auth Architecture

```
/src/lib/auth/
  session.ts       ← JWT creation, parsing, refresh using jose
  proxy.ts         ← Next.js proxy boundary: route protection + role redirect
  rbac.ts          ← role → permission mapping; withRole() server utility
  seed.ts          ← idempotent admin seed (CLI: npm run seed:admin)
```

### Session Shape

```ts
type SessionPayload = {
  userId: string;
  role: UserRole;
  department: string;
  name: string;
  email: string;
  iat: number;
  exp: number;
};
```

### Route Groups & Protection

```
(auth)/          → /login — no session required
(app)/           → all dashboard routes — requires valid session
  (ceo)/         → /admin → roles: ceo
  (ops)/         → /ops   → roles: gm, bd_head, agent, property_manager
  (finance)/     → /fin   → roles: accounts_manager, accounts_officer
  (hr)/          → /hr    → roles: hr_manager
  (reporting)/   → /reports → roles: auditor, internal_auditor (+ others read-only)
```

Middleware intercepts every `/(app)/` route. Wrong-role navigation silently redirects to the correct role root. No error page — just a clean redirect.

### Seed Admin

```bash
# .env
CEO_SEED_EMAIL=ceo@sunlandre.co.ke
CEO_SEED_PASSWORD=<strong-generated>

# Run once
npm run seed:admin
```

---

## 10. Module Map — Routes

### Route Architecture

```
/                    → redirect to role root
/login               → auth entry (glass card, Sunland logo, Outfit form)

/admin               → CEO dashboard (executive overview)
/admin/contacts      → contacts CRM directory
/admin/contacts/[id] → contact command panel (detail + activity)
/admin/properties    → property database
/admin/properties/[id] → property command panel
/admin/pipeline      → BD CRM pipeline (all stages, all agents)
/admin/pipeline/[id] → lead command panel
/admin/leases        → all active + expiring leases
/admin/leases/[id]   → lease command panel
/admin/maintenance   → maintenance request queue
/admin/finance       → revenue, rent collection, commissions
/admin/finance/transactions → full transaction ledger
/admin/valuations    → valuation pipeline (Sunland Valuers Ltd)
/admin/hr            → HR module (redirect to /hr for hr_manager)
/admin/reports       → analytics, KPI, custom reports
/admin/settings      → system settings, user management

/ops                 → GM / BD operational dashboard
/ops/contacts        → contacts (BD context)
/ops/properties      → property inventory
/ops/pipeline        → BD pipeline (scoped to role: bd_head sees all, agent sees own)
/ops/leases          → leasing operations
/ops/maintenance     → maintenance queue (property manager context)
/ops/valuations      → valuation tracker

/fin                 → Accounts dashboard
/fin/collection      → rent collection module
/fin/commissions     → commission ledger
/fin/transactions    → transaction entry and ledger
/fin/statements      → owner and tenant statements

/hr                  → HR dashboard
/hr/staff            → staff directory
/hr/leave            → leave management
/hr/performance      → appraisal records
/hr/payroll          → payroll coordination

/reports             → Read-only analytics (auditor + others)
```

### CEO Dashboard (`/admin`)

The CEO's surface is the entire business in one page. Four panels:

1. **Business Development Strip** — active mandates count, total pipeline value (KES, JetBrains Mono), transactions closed this month.
2. **Property Management Strip** — occupancy rate (% gauge), rent collection rate (% gauge), arrears total (amber), vacant units (count).
3. **Finance KPIs** — revenue MTD, expenses MTD, net (success green if positive, error red if negative), cash flow indicator.
4. **Client Success** — active managed clients, open complaints, follow-ups due this week.

Below the KPI strip: a pipeline funnel (Recharts bar/funnel chart), rent collection trend (Recharts area chart), activity feed (EngagementTimeline pattern), and upcoming actions.

---

## 11. Component System

### Inherited Patterns (from Andishi Playbook)

These patterns carry directly into Sunland CRM with Terrain token substitution:

- **EngagementTimeline** — `grid-cols-[1.5rem_minmax(0,1fr)]` dot connector layout. Used in contact detail, lead history, lease activity.
- **Command Panel** — Large stat figure + insight text + InfoTile grid + timeline + notes + action buttons. Used in all entity detail drawers.
- **Stage Distribution Strip** — horizontal bar with gradient connectors. Click-to-filter. Used in pipeline, lease, valuation, maintenance modules.
- **Left Border Accent Cards** — `absolute inset-y-0 left-0 w-[3px]` with semantic color per record type.
- **`enrichRecord()`** — compute derived narrative fields from lean seed data. Use for pipeline stage labels, lease status badges, arrears descriptions.

### New Component Patterns

#### `<PropertyCard>`
A physical property card with thumbnail image, property ID (mono), type badge, location, size, asking price or rent (JetBrains Mono amber), status badge, and agent avatar. Two variants: grid view (portrait card) and list view (horizontal row). No nested glass.

#### `<ContactCard>`
Contact initials avatar (if no photo) + name + type badge (landlord/tenant/buyer) + phone (mono) + assigned agent. Click opens the Contact Command Panel drawer.

#### `<PipelineFunnel>`
A Recharts-based horizontal funnel or vertical bar showing stage counts and conversion rate between stages. Amber for value labels, green for count labels. Click a stage bar to filter the pipeline table to that stage.

#### `<RentCollectionGauge>`
A circular progress arc (SVG or Recharts RadialBarChart) showing collected vs. expected rent for the current month. The arc fills with the success/estate token while primary yellow remains reserved for action and selection. Outstanding arrears display below in JetBrains Mono.

#### `<LeaseExpiryTimeline>`
A horizontal timeline showing leases expiring in the next 90/180/365 days. Each item is a chip with tenant name, property ID, expiry date (mono), and action button. Overdue leases glow red.

#### `<MaintenanceQueue>`
A vertical list of maintenance requests sorted by priority. Each row: priority badge (critical/high/normal/low), category icon (Tabler), property name, brief description, assigned contractor, days open (mono in amber if > 7 days), status chip.

#### `<CommissionSplitViewer>`
For closed deals: shows total commission earned, split by agents involved (percentage + KES amount in JetBrains Mono), VAT calculation, net payable. The Sunland house cut is highlighted with the primary yellow action token.

#### `<OccupancyHeatMap>`
Optional enhancement for property managers: a mini grid view of all units in a managed building. Each unit cell is colored by status: green (occupied), amber (notice given), red (vacant/overdue), gray (off-market).

### Shared Primitives

| Component | Purpose |
|---|---|
| `<EntityDrawer>` | Right-sliding detail panel. 480px wide on desktop. Full-screen on mobile. `Escape` closes. |
| `<ConfirmDialog>` | Modal for destructive actions (delete contact, terminate lease). Never repurposed for non-destructive flows. |
| `<ToastProvider>` | Global dismissible toast system. Success (green), warning (amber), error (red), info (cobalt). Max 3 visible. Bottom-right desktop, raised above mobile bottom nav. |
| `<SkeletonBlock>` | Content-shaped skeleton using `animate-pulse`. Every data-fetching state must have a matching skeleton, not a spinner. |
| `<EmptyState>` | Icon + title + description + single action button. Each module has a role-specific empty state with a relevant next action. |
| `<SearchBar>` | Debounced (300ms), clears on Escape, expands on focus. Surfaces contacts, properties, and leads in a command-palette-style dropdown. |
| `<FilterChips>` | Horizontal scrollable filter row. Active filters show as closable chips with `--primary` fill. |
| `<DataTable>` | Sortable, filterable, paginated. Keyboard accessible. Row actions via a `...` menu, not inline buttons. Fixed header, virtualized for > 200 rows. |
| `<StatusBadge>` | Pill badge. Color from semantic tokens. Text in label-caps. No icons inside badges — adjacent icons only. |
| `<AvatarGroup>` | Stacked avatars for team/assignee displays. Max 4 visible, then `+N` overflow indicator. |
| `<InlineEditField>` | Click-to-edit field. Shows pencil icon on hover. Saves on blur or Enter. Cancels on Escape. Only for non-critical fields (notes, tags). |
| `<RoleGate>` | Client-side role check component. Server-side via `withRole()` utility. |
| `<SunlandNav>` | Fixed left sidebar with role-scoped navigation sections. Expanded mode uses one-open-section accordion groups; collapsed mode becomes a compact icon rail for primary destinations. |
| `<TopNav>` | Floating command bar with search, date/calendar, messages, notifications, quick-create, display mode control, and user menu. Mobile uses a top floating search/action pill. |
| `<MobileBottomNav>` | Mobile-only floating pill navigation for the five highest-frequency destinations. |
| `<MobileNavigationDrawer>` | Mobile full navigation drawer for all grouped routes. |

---

## 12. Real-time Strategy

### What Gets Real-time Updates

WebSockets are reserved for events that genuinely require immediate awareness — not polling sugar-coating.

| Event | Channel | Recipients |
|---|---|---|
| New lead enquiry | `leads:new` | BD team + CEO/GM |
| Lead stage change | `lead:{id}:stage` | Assigned agent + BD head |
| Payment received | `payments:received` | Accounts + Property manager + CEO |
| Maintenance request submitted | `maintenance:new` | Property manager + GM |
| Maintenance status update | `maintenance:{id}:status` | Property manager + tenant contact |
| Lease near-expiry alert | `leases:expiry` | Property manager + agent |
| New user action (CEO only) | `audit:action` | CEO + internal auditor |

### Implementation Stack

**Primary transport: Ably Realtime**

Ably's managed WebSocket infrastructure works in Vercel's serverless environment without polling or self-hosted server overhead. The Next.js API route `/api/realtime/token` issues client tokens. Ably channels are namespaced by entity type and ID.

```ts
// src/lib/realtime/ably.ts
import Ably from 'ably';

export const ablyRest = new Ably.Rest({ key: process.env.ABLY_API_KEY });
export const getAblyToken = async (userId: string) => {
  return ablyRest.auth.createTokenRequest({ clientId: userId });
};
```

**Fallback: SSE for notification-only streams**

Notification feeds (the bell icon popover) use a simple Server-Sent Events endpoint at `/api/notifications/stream`. SSE is sufficient for read-only streams and survives Vercel's serverless limitations better than persistent WebSocket connections for low-frequency updates.

### Notification Shape

```ts
type SunlandNotification = {
  id: string;
  type: 'lead' | 'payment' | 'maintenance' | 'lease' | 'system';
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  href?: string;    // where to navigate when tapped
  readAt?: string;
  createdAt: string;
};
```

The notification bell in the top nav shows an unread count badge. The popover lists the 10 most recent, with a "View all" link to `/admin/notifications` (or role equivalent).

---

## 13. Caching Strategy

### What Gets Cached

Sunland CRM has several expensive aggregation queries that run on every dashboard load but change infrequently. Redis caching via Upstash prevents these from becoming DB bottlenecks as data volume grows.

| Cache Key Pattern | TTL | Contents |
|---|---|---|
| `dashboard:ceo:kpis` | 5 min | Pipeline value, rent collection %, occupancy, revenue MTD |
| `dashboard:ops:pipeline:{userId}` | 3 min | Pipeline stage counts for agent/BD context |
| `properties:summary:counts` | 15 min | Total by type, by status, by listing type |
| `leases:expiry:90d` | 30 min | Leases expiring in 90 days list |
| `contacts:search:{query}` | 2 min | Contact search results (cache key includes query hash) |
| `transactions:summary:{month}` | 10 min | Monthly revenue/expense aggregation |
| `maintenance:open:counts` | 5 min | Open maintenance by priority count |

### Cache Invalidation Rules

- On any write to `transactions`, invalidate `transactions:summary:*` and `dashboard:ceo:kpis`.
- On any write to `leases`, invalidate `leases:expiry:90d` and `dashboard:ceo:kpis`.
| On any write to `properties`, invalidate `properties:summary:counts`.
- Contact search results are short-lived (2 min) — no explicit invalidation needed.

### Upstash Client Pattern

```ts
// src/lib/cache/upstash.ts
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  const cached = await redis.get<T>(key);
  if (cached) return cached;
  const fresh = await fetcher();
  await redis.setex(key, ttlSeconds, fresh);
  return fresh;
}
```

---

## 14. State Management

### Separation of Concerns

| State Type | Tool | Where |
|---|---|---|
| Server-derived data (contacts, properties, leads, etc.) | TanStack Query | All data-fetching components |
| UI ephemeral state (sidebar open, filter values, selected row ID, drawer open) | Zustand | Dashboard shell + module pages |
| Form state | React Hook Form | All forms |
| URL-persisted state (active tab, table sort, pagination) | `nuqs` (URL search params) | Table pages, pipeline views |

### Zustand Store Structure

```ts
// src/store/ui.ts
type UIStore = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  activeDrawer: string | null;  // entity ID
  openDrawer: (id: string) => void;
  closeDrawer: () => void;
};

// src/store/pipeline.ts
type PipelineStore = {
  activeStage: PipelineStage | 'all';
  setStage: (stage: PipelineStage | 'all') => void;
  selectedLeadId: string | null;
  setSelectedLead: (id: string | null) => void;
};
```

### TanStack Query Conventions

- All server data flows through query functions in `/src/lib/queries/`.
- Use `queryKey` arrays with entity type + any filter params: `['contacts', { type: 'tenant', search: 'Ali' }]`.
- Optimistic updates for inline field edits (notes, stage changes).
- Background refetch interval: 60 seconds on dashboard KPI queries. Not on tables (user-triggered refetch only, via explicit refresh button).
- Prefetch entity detail on hover for contacts and properties to make drawer opens feel instant.

---

## 15. UI/UX Standards

### Navigation

**Desktop sidebar** — fixed, 240px. Contains Sunland logo, user avatar + role badge, module navigation grouped by function. Collapsible to 64px icon rail — tooltips on hover for icon labels. No nested sub-navigations in the sidebar (flat list only). Sub-navigation lives in page-level tab bars.

**Mobile** — full-screen drawer triggered by hamburger. Bottom navigation bar with 5 max items for most-used modules. Drawer slides in from left with `drawerSpring`.

**Top nav** — role label, search bar, notification bell with unread count, user avatar menu (profile, settings, sign out). Scroll-aware: slightly reduced padding after scrolling 32px.

### Tables

All data tables follow this contract:
- Keyboard navigable (Tab between rows, Enter to open detail drawer)
- Sortable column headers with visible sort indicator
- Client-side column filtering for short lists; server-side for > 200 rows
- Pagination: 25 rows default, 50/100 options. Page number in URL param.
- Row action menu (`...`) with: View, Edit, and contextually relevant actions
- Bulk selection checkbox with bulk actions bar (archive, assign, export)
- Empty state with role-specific messaging

### Drawers

Entity detail drawers (contacts, properties, leads, leases) follow the Command Panel pattern:

```
[ Large primary stat or status ]
[ Next action insight text ]
[ InfoTile grid — 2x2 or 2x3 ]
[ EngagementTimeline — recent activity ]
[ Notes (inline editable) ]
[ Action buttons row ]
```

- Drawers are 480px wide on desktop (640px for complex entities like properties)
- Close on Escape key, close button in top right, background overlay click
- Focus trap while open
- Header sticky, content scrollable

### Modals

Modals are strictly for discrete decisions only:
- Create new record (lead, contact, property)
- Confirm destructive action (delete, terminate, blacklist)
- Never use modals for entity detail views (that's a drawer)

### Forms

- Inline validation as the user types (on blur after first interaction)
- Error messages immediately below the field that failed
- Persistent save affordance: the submit button never disappears while the form is dirty
- Loading state on submit: button shows a spinner, inputs are disabled
- Success: close modal/drawer + toast notification
- Error: toast with error summary + form stays open

### Toasts

```
Success:  left icon (IconCheck)    + success green border
Warning:  left icon (IconAlertTriangle) + amber border
Error:    left icon (IconX)        + error red border
Info:     left icon (IconInfoCircle)   + cobalt border
```
- Duration: 4s for info/success, 6s for error (requires manual dismiss or auto with a close button)
- Max 3 toasts visible at once
- Position: bottom-right (desktop), bottom-center (mobile)

### Skeletons

Every data-loading state must have a content-shaped skeleton:
- Not spinners. Not generic "loading..." text.
- KPI cards: rectangular skeleton with subtle gradient shimmer
- Tables: 8 row skeletons matching the column structure
- Contact/property cards: matching shape placeholders
- `animate-pulse` is acceptable for skeleton fills only

### Empty States

Each empty state must have:
- A relevant Tabler icon (not generic)
- A short title (what's missing)
- One sentence explanation (why and what to do)
- A single primary action button

Example: Contacts page for a new agent:
```
[IconUsersGroup icon]
"No contacts yet"
"Contacts you manage or are assigned to will appear here."
[Button: "Add your first contact"]
```

### KES Currency Formatting

All monetary values:
- Use `Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' })`
- Display in JetBrains Mono (`mono-amount` or `mono-stat`)
- Large values: abbreviate in KPI summaries (KES 4.2M, KES 850K)
- Full values in detail tables and drawers

---

## 16. Implementation Sequence

### Phase 0 — Foundation (Week 1)

1. Next.js App Router scaffold with route groups: `(auth)`, `(app)/(ceo)`, `(app)/(ops)`, `(app)/(fin)`, `(app)/(hr)`, `(app)/(reports)`
2. Tailwind v4 config with all Terrain Identity CSS tokens in `globals.css`
3. Drizzle schema definitions — all tables in `/src/db/schema/`
4. First migration and Neon database connection verified
5. JWT auth utilities (`session.ts`, `proxy.ts`)
6. Seed admin: `ceo@sunlandre.co.ke` created, signs in, lands on `/admin`
7. `<SunlandNav>`, `<TopNav>`, `<MobileBottomNav>`, and `<MobileNavigationDrawer>` shell — desktop and mobile variants
8. `<ToastProvider>`, `<ConfirmDialog>`, `<Modal>`, `<Drawer>`, `<DropdownMenu>`, `<Avatar>`, and `<IconButton>` global primitives
9. TanStack Query and Zustand providers in root layout

**Gate:** CEO can sign in and see an empty `/admin` shell with correct navigation.

### Phase 1 — Contacts & Properties (Weeks 2–3)

1. Contacts module: table, filters, create modal, `<ContactCard>`, Command Panel drawer
2. Properties module: grid/list view, `<PropertyCard>`, create modal, Command Panel drawer
3. Search: global search bar connecting to contacts + properties
4. Activity logging on record create/edit

**Gate:** User can create a contact, create a property, link them, and view both with full activity history.

### Phase 2 — BD Pipeline (Weeks 3–4)

1. Leads/pipeline module with `<PipelineFunnel>`, `<StageDistributionStrip>`
2. Lead create modal: contact + property selection, stage, expected value
3. Stage progression UX (drag-free — explicit stage dropdown in the drawer)
4. Viewing scheduling (date/time picker, activity log entry)
5. Commission calculator for closed deals

**Gate:** Agent can manage a full pipeline from lead to close. BD head can see all agents' pipelines with stage counts.

### Phase 3 — Leases & Property Management (Weeks 4–5)

1. Leases module: table, `<LeaseExpiryTimeline>`, create/renew/terminate flows
2. Property management context: rent collection, `<RentCollectionGauge>`, arrears view
3. Maintenance module: `<MaintenanceQueue>`, create request, assign contractor, status updates
4. Notifications: lease expiry alerts, overdue maintenance, rent due reminders

**Gate:** Property manager can manage their full portfolio — active leases, maintenance queue, rent collection status.

### Phase 4 — Finance & Accounts (Weeks 5–6)

1. Finance module: rent collection dashboard, `<CommissionSplitViewer>`, transaction ledger
2. Revenue analytics: Recharts area chart (monthly trend), pie chart (revenue by type)
3. Transaction recording forms with approval workflow
4. Owner and tenant statement generation

**Gate:** Accounts officer can record rent payments and flag arrears. Accounts manager can view all financial KPIs.

### Phase 5 — Valuation Tracker (Week 6)

1. Valuations module mirroring the pipeline pattern
2. Status progression: instruction → inspection → preparation → delivery → fee collection
3. Report upload via Cloudinary
4. Fee collection tracking linked to `transactions`

### Phase 6 — CEO Dashboard & Real-time (Week 7)

1. Executive dashboard: all four KPI panels, charts, activity feed
2. Upstash Redis caching for dashboard aggregation queries
3. Ably WebSocket integration for live notifications
4. Notification bell with SSE stream + `/admin/notifications` list

**Gate:** CEO signs in and sees live, accurate business data. Notification bell shows real-time events.

### Phase 7 — HR Module & Reporting (Week 8)

1. HR module: staff directory, leave management, performance records
2. Reports module (auditor context): predefined reports — pipeline performance, rent collection efficiency, occupancy trend, commission summary
3. CSV/PDF export for reports

### Phase 8 — Polish & QA

1. Responsive QA across mobile, tablet, desktop, wide desktop
2. Keyboard accessibility audit (Tab order, Escape handlers, focus traps)
3. Skeleton states for all loading conditions
4. Empty state audit — every list/table has one
5. Error boundary review
6. Performance audit: Lighthouse, no uncached dashboard queries

---

## 17. Quality Gates

### TypeScript

TypeScript is the primary verification gate. Run after every meaningful change:

```bash
npx tsc --noEmit
```

No `any` types in schema, auth, or query layer. `unknown` is acceptable in catch blocks.

### Drizzle Migrations

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

Never edit generated migration files. Schema changes go in schema files, then regenerate.

### Lint

```bash
npx next lint
```

ESLint with `next/core-web-vitals` ruleset. No suppressed errors.

### Accessibility Baseline

Every screen must pass:
- 4.5:1 contrast ratio on all body text against its background (verify with tokens)
- All icon-only controls have `aria-label`
- All form inputs have visible labels (not placeholder-only)
- Modal/drawer focus traps are functional
- `Escape` closes all overlays

### Completion Definition

The system is complete when:

- CEO signs in and sees live KPI data for business development, property management, finance, and client success.
- Agents can manage their full pipeline independently.
- Property managers can handle their full portfolio — leases, maintenance, rent collection — without leaving the CRM.
- Accounts officers can record and track all financial transactions.
- All roles are correctly scoped — wrong-role route access silently redirects, never shows a 404 or error.
- Every module has a functional empty state, loading skeleton, and error state.
- The system runs without uncached dashboard queries in production (Redis layer confirmed active).
- Mobile view is usable for agents in the field checking pipeline and contact details.
- Notification system delivers real-time alerts for leads, payments, and maintenance events.

---

## Appendix A — Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Auth
JWT_SECRET=...
JWT_EXPIRY=7d

# Caching
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Real-time
ABLY_API_KEY=...

# File Storage
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Seed
CEO_SEED_EMAIL=ceo@sunlandre.co.ke
CEO_SEED_PASSWORD=...
```

## Appendix B — File Structure Overview

```
src/
  app/
    (auth)/
      login/page.tsx
    (app)/
      (ceo)/
        admin/
          page.tsx           ← CEO dashboard
          contacts/...
          properties/...
          pipeline/...
          leases/...
          maintenance/...
          finance/...
          valuations/...
          reports/...
          settings/...
      (ops)/
        ops/...
      (fin)/
        fin/...
      (hr)/
        hr/...
  components/
    ui/                      ← shared primitives (DataTable, EntityDrawer, etc.)
    sunland/                 ← CRM-specific components (PropertyCard, PipelineFunnel, etc.)
    layout/                  ← SunlandNav, TopNav, mobile nav, shells
  db/
    index.ts
    schema/...
    migrations/...
  lib/
    auth/...
    cache/upstash.ts
    realtime/ably.ts
    queries/...              ← all TanStack Query functions
    utils/                   ← cn(), formatKES(), enrichRecord()
  store/
    ui.ts
    pipeline.ts
  types/
    index.ts
```

---

*Sunland CRM — Sunland Real Estates · Internal Operations Platform*
*Built on Next.js · Terrain Identity Design System · PostgreSQL + Drizzle · Ably + Redis*

---

## 18. Mock Data Contract

Until the database-backed modules are wired, frontend dashboard data is centralized in:

```
src/lib/mock-data/sunland.ts
```

The overview page must not define local mock arrays. Components should fetch via:

```
src/lib/queries/dashboard.ts
```

This keeps one source of truth for:

- Executive KPIs
- Pipeline stage summaries
- Priority opportunities
- Calendar tasks
- Maintenance queue
- Lease expiries
- Property snapshots
- Command alerts
- Activity feed
- Finance summary
- Team workload

When PostgreSQL queries are ready, replace the internal fetcher in `getExecutiveDashboard()` while keeping the response shape stable enough that the dashboard component does not need broad rewrites.
