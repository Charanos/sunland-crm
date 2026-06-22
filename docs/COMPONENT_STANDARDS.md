# Component Standards

This is the shared UI contract for ERP dashboard work. It exists to prevent every department from inventing its own cards, tables, filters, drawers, and empty states.

## Global Primitives

Use `src/components/ui` for reusable primitives across departments:

| Primitive | Required Use |
|---|---|
| `Button` | Primary, secondary, ghost, and danger actions |
| `Badge` | Status labels and compact entity context labels |
| `Card` | Generic surface wrapper for repeated content |
| `BoardHeader` | Department dashboard and board page headers |
| `BoardPanel` | KPI/data panels inside board layouts |
| `KpiCard` | Metric cards in the analytics tier |
| `PaginationControls` | Any 5-8 row dashboard table pagination |
| `Modal` | Create/log/request flows |
| `Drawer` | Detail views |
| `ConfirmDialog` | Destructive or consequential decisions |
| `ToastProvider` | Success, warning, error, and info feedback |
| `EmptyState` | Empty dashboards, queues, and tables |

Department folders may contain domain components, but not duplicate global primitives. For example, `src/components/finance/payroll-run-drawer.tsx` is valid; `src/components/finance/card.tsx` is not.

## Board Layout

Every department dashboard follows this shape:

1. `BoardHeader`: title, subtitle, entity context, search, and primary action.
2. KPI tier: 3-4 `KpiCard` components.
3. Data tier: a `BoardPanel` containing a table, grid, queue, or activity list.

Do not build landing pages for internal departments. The first screen is the actual operating surface.

## Tables

- Dashboard tables show 5-8 rows per page.
- Row actions live in a `...` menu.
- Clicking a row or primary record label opens a Drawer.
- Sort state is visible in the column header.
- Use content-shaped skeleton rows for loading states.
- Empty tables use `EmptyState` with one role-appropriate action.

## Forms

- React Hook Form + Zod for every form.
- The same Zod schema validates the API route.
- Field errors render under the field.
- Submit buttons show loading state and disable inputs while pending.
- Successful create/update/delete emits a toast and closes the modal or drawer.

## Status Badges

Use only the approved semantic set:

- `success`: approved, paid, resolved, on-track.
- `warning`: awaiting approval, pending review, scheduled.
- `risk`: rejected, overdue, defaulted, deficit, critical.
- `data`: neutral analytics or system labels.
- `primary`: selected entity or primary operating context.

## Department-Specific Guides

For advanced specifications, layout extensions, and business logic validation rules scoped to specific departments:
- Refer to [Finance Revamp Design & Implementation Guide](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/docs/FINANCE_REVAMP_DESIGN_GUIDE.md) when building Ledger, Rentals, Mandates, Payroll, AP/AR, Cheques, or Fees pages.

## Prohibited Patterns

- Local currency formatters.
- Local modal, drawer, toast, confirm dialog, pagination, or KPI card clones.
- `font-semibold`, `font-bold`, or CSS font weights above 500.
- Legacy teal `#15464e`.
- A department-specific entity switcher.
