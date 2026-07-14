# Sunland ERP

Internal Real Estate ERP foundation for Sunland Real Estates. This application is the operating layer for executive oversight, Finance, HR, Business Development, Front Office, and Operations across the Sunland Group entities.

## Tech Stack

- Next.js App Router with TypeScript
- Tailwind CSS v4 design tokens
- Drizzle ORM with PostgreSQL/Neon
- Custom JWT sessions with `jose`
- TanStack Query and Zustand
- Realtime adapter, Upstash Redis, Cloudinary-ready integrations

## Architecture & UI Direction

- Product naming in code and UI is `Sunland ERP`.
- The source of truth is `docs/SUNLAND_ERP_IMPLEMENTATION_SPEC.md`.
- Agent build rules live in `Agents/SKILL.md`.
- Primary brand/action color is Sunland Yellow, with semantic emerald, rose, and amber reserved for operational states.
- The current CEO/Admin dashboard is the visual reference implementation for all future department dashboards.
- Desktop uses a dark collapsible command sidebar with one-open-section accordion groups.
- Collapsed desktop sidebar becomes a compact icon rail for primary destinations.
- Mobile uses a floating top search/action pill and a floating bottom pill nav for frequent routes.
- Full mobile navigation is available through the grouped drawer.

## Data Schema & Terminologies

- Property designations strictly follow Sunland.co.ke: `All Properties`, `Apartment`, `Commercial`, `House`, `Land`, and `Villa`. 
- ERP data is entity-scoped. New database tables carry `entity_id` unless explicitly global.
- Mock data lives in `src/lib/mock-data/sunland.ts` and simulates complex nested relations across departments.
- UI components fetch dashboard data through `src/lib/queries/dashboard.ts`, bypassing direct mock data imports. 
- When the backend is ready, replace the fetcher in `getExecutiveDashboard()` with real database/API calls while preserving the response shape.

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000/` (which redirects automatically to `/login`).

## Development Access & Emulation Switcher

For rapid testing and verification, the Login screen houses an **Authorized Workspace Portals** section. This allows you to immediately delegate a secure session to any of the six primary operational roles we are building dashboards for:
- **CEO** (Paul Amos - `ceo` portal: `/admin`)
- **GM** (Grace Mutua - `general_manager` portal: `/admin`)
- **Finance** (Dennis Munge - `finance_head` portal: `/fin`)
- **HR** (Cody Fisher - `hr_head` portal: `/admin/hr`)
- **Line Manager / Business Dev** (Jared Omondi - `line_manager` portal: `/admin/pipeline`)
- **Front Office** (Sharon Koech - `front_office_head` portal: `/admin/front-office`)

All profiles share the default local password: `sunland-demo`.

To reset and seed the database with these profiles, run a POST request to `/api/auth/seed` or execute:
```bash
npm run db:seed
```

## Quality Gates

```bash
npm run typecheck
npm run lint
npm run build
```

## Database

Set `DATABASE_URL`, then run:

```bash
npm run db:generate
npm run db:migrate
```

Schema lives in `src/db/schema/index.ts`.
