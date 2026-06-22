# Operations & Maintenance Module Reference

The Operations & Maintenance module is a locked reference implementation carried forward into the ERP. New department modules should match its interaction model, not fork it.

## Canonical Route

- `/admin/maintenance`

Do not create new ERP functionality under `/ops`. Legacy short routes may redirect only.

## Scope

Operations manages physical maintenance, compliance audits, contractor scheduling, repair costs, and unit turnover work. It remains distinct from Front Office logistics, which owns vehicle assignments, appointments, office petty cash, and paperwork processing.

## UI Pattern

Operations follows the ERP board pattern:

1. Unified header with title, subtitle, filters, search, and primary action.
2. KPI tier for monthly repair cost, open ticket count, critical tickets, and contractor performance.
3. Data tier for tickets and operational tasks.
4. Modal for logging or assigning work.
5. Drawer for ticket detail and state changes.
6. Confirm Dialog for destructive or consequential actions.
7. Toast for every CRUD result.

## Design Requirements

- Primary actions use Sunland Yellow `#f3df27` with Brand Dark `#151936`.
- Brand Dark `#151936` is the only dark brand color.
- Awaiting approval uses amber semantic styling.
- Critical/overdue uses rose semantic styling.
- Resolved/on-track uses emerald semantic styling.
- Currency and ticket IDs use `font-mono`.
- KES values use `formatCompactKES()`.
- Font weights stay at or below 500.

## ERP Integration

Operations repair costs feed Finance; they are not standalone financial truth. Any contractor spend above configured thresholds must create an `approval_requests` row and wait for server-side approval before financial posting.
