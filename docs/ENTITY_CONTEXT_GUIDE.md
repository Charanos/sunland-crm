# Entity Context Guide

The Global Entity Context scopes the ERP to one of Sunland's operating entities.

## Entities

1. Sunland Group
2. Sunland Commercial
3. Sunland Residential
4. Sunland Valuers Ltd

## State Owner

Entity state is centralized in `src/store/ui.ts`:

- `activeEntityId`
- `switchingToEntityId`
- `dashboardLoading`
- `setActiveEntity`
- `startEntitySwitch`
- `completeEntitySwitch`

Departments must read this state. They must not implement their own entity switchers or parallel entity stores.

## UI Owner

The switcher UI is `src/components/layout/entity-switch-overlay.tsx`. It handles the transition experience and keeps the dashboard visually consistent during context changes.

## Data Contract

Every new ERP table and query includes `entity_id` unless the data is explicitly global. Existing prototype tables are being migrated toward this contract.

Department dashboards must apply entity filters on both the client query key and the server query. Client-only filtering is not enough for ERP data isolation.

## Dashboard Integration

The CEO/Admin dashboard reads the active entity and updates:

- KPI cards.
- Revenue chart.
- Listing board.
- Market insights.
- Operations context.

New Finance, HR, Business Development, and Front Office dashboards follow the same pattern.

## Formatting Rules

- Financial values remain KES.
- Use `formatCompactKES()` for compact display.
- Use `font-mono` for entity-scoped IDs, dates, amounts, and references.
