# Sunland CRM

Internal CRM dashboard foundation for Sunland Real Estates. This application serves as the central command center for tracking the commercial, residential, and overarching real estate portfolio.

## Tech Stack

- Next.js App Router with TypeScript
- Tailwind CSS v4 design tokens
- Drizzle ORM with PostgreSQL/Neon
- Custom JWT sessions with `jose`
- TanStack Query and Zustand
- Ably, Upstash Redis, Cloudinary-ready integrations

## Architecture & UI Direction

- Product naming in code and UI is `Sunland CRM`.
- Primary brand/action color is Sunland Yellow, with green reserved for success and estate-health states.
- The UI includes comprehensive dashboard overviews with unified property filtering, real-time metrics, interactive operational analytics, and cross-department scheduling.
- Desktop uses a dark collapsible command sidebar with one-open-section accordion groups.
- Collapsed desktop sidebar becomes a compact icon rail for primary destinations.
- Mobile uses a floating top search/action pill and a floating bottom pill nav for frequent routes.
- Full mobile navigation is available through the grouped drawer.

## Data Schema & Terminologies

- Property designations strictly follow Sunland.co.ke: `All Properties`, `Apartment`, `Commercial`, `House`, `Land`, and `Villa`. 
- Mock data lives in `src/lib/mock-data/sunland.ts` and simulates complex nested relations across departments.
- UI components fetch dashboard data through `src/lib/queries/dashboard.ts`, bypassing direct mock data imports. 
- When the backend is ready, replace the fetcher in `getExecutiveDashboard()` with real database/API calls while preserving the response shape.

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000/admin`.

In development, `SUNLAND_AUTH_BYPASS=true` lets the admin shell load before auth and seed data are finished. Set it to `false` to test the JWT boundary.

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
