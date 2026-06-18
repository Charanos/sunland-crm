# Sunland CRM Entity Switcher & System Guide

## Context & Architecture
The CRM handles multiple business divisions ("Entities") within the Sunland Group:
1. **Sunland Group** (Consolidated Headquarters)
2. **Sunland Commercial** (Offices, Retail, Industrial)
3. **Sunland Residential** (Villas, Apartments, Estates)
4. **Sunland Valuers Ltd** (Valuation & Advisory)

To prevent data leakage and operational confusion, the system employs a **Global Entity Context**. When a user switches an entity, the entire dashboard and routing system immediately reflects the new context.

## State Management (`useUIStore`)
Entity state is managed globally via Zustand in `src/store/ui.ts`:
- `activeEntityId`: The currently active division.
- `switchingToEntityId`: Temporary state during transition animations.
- `dashboardLoading`: Global loading state during heavy context switches.

## Transition Overlay (`entity-switch-overlay.tsx`)
When switching, an overlay hijacks the screen for 2.5 seconds.
1. It reads the target entity from `ENTITIES` registry.
2. Displays the entity's Unsplash image, description, and stats.
3. Updates the URL query parameter (`?entity=commercial`).
4. Next.js `page.tsx` catches the param and passes it to the `DashboardOverview`.
5. The `DashboardOverview` re-renders with the new context data.

## Dashboard Overview Integration
The `DashboardOverview` component is deeply integrated with the entity context:
1. **KPI Cards**: Dynamically pull data specific to the entity.
2. **Revenue Chart**: Updates the dataset based on division.
3. **Listing Board**: Filters the property array by the selected division.
4. **Market Insights**: Normalizes property insights based on division.

## Production-Grade UI Primitives Added
1. **Toast System**: Slide-in/out animations, auto-dismiss progress bar, and 4 tones.
2. **Modal System**: Size variants, scroll locks, scale-in animations, and backdrop closing.
3. **Drawer System**: Side-panel slides, sticky footers, scroll locking.
4. **Confirm Dialog**: Action validation with loading state spinners.

## Implementation Details
All financial data has been standardized to **KES**. Formatting is handled by `formatCompactKES()` inside `src/lib/utils/format.ts` to ensure consistency.
Pagination has been implemented on all major data tables, keeping views limited to 5-8 items per page to maintain the clean layout.

### Recent Fixes
- **Hydration Mismatch**: Fixed a Next.js hydration error in `dashboard-overview.tsx` caused by rendering `new Date()` directly on the server by wrapping the timestamp rendering in a `mounted` check.
- **Missing Imports**: Resolved an issue in `internal-operations-board.tsx` where `IconEdit` was used but not imported from `@tabler/icons-react`.
