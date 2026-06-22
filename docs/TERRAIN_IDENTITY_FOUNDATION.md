# Terrain Identity Foundation

This document preserves the design language carried forward into the Sunland Real Estate ERP. It supports `SUNLAND_ERP_IMPLEMENTATION_SPEC.md`; it does not override the ERP module map, finance-first sequence, approval rules, or role matrix.

## Product Identity

Sunland ERP is a private operating system for real estate finance, HR, business development, front office, operations, and executive oversight. The interface must feel dense, calm, premium, and operational. It is an internal command workspace, not a public portal or marketing site.

## Visual Tokens

| Token | Value | Use |
|---|---|---|
| Sunland Yellow | `#f3df27` | Primary create, submit, confirm, and selected action states |
| Sunland Yellow Hover | `#e6d220` | Primary action hover |
| Brand Dark | `#151936` | Sidebar, active pagination, primary chart strokes, dark buttons |
| Warm Workspace | `#f4f6f0` | App background |
| Soft Workspace | `#edf2e6` | Muted panels and inset surfaces |
| Card Surface | `#ffffff` | Board panels and repeated item cards |
| Positive | `emerald-500/20` + `emerald-300` | Paid, approved, resolved, on-track |
| Critical | `rose-500/20` + `rose-300` | Rejected, overdue, deficit, critical |
| Awaiting Approval | `amber-500/20` + `amber-300` | Pending GM/CEO/department head approval |

The retired teal `#15464e` must not be used. When a state fits the semantic palette above, do not invent a new module-specific color.

## Typography

- Page and section titles use `title-serif` with Cormorant Garamond, `font-weight: 300`.
- Body and interface text use nunito.
- KES amounts, dates, IDs, ticket references, mandate references, payroll references, percentages, and compact metrics use JetBrains Mono.
- Font weights are capped at 500. Use size, color, spacing, and hierarchy instead of `font-semibold` or `font-bold`.
- Letter spacing is `0` for numeric mono data. Caps labels may use positive tracking only.

## Surface Model

ERP pages use the existing CEO/Admin dashboard prototype as the north star:

- Dark sidebar and navigation shell.
- Warm workspace background.
- White or near-white board panels with 8px radius unless a locked legacy primitive already uses a larger radius.
- Board pages are composed as header, KPI tier, data tier.
- Cards are for repeated items, metrics, modals, drawers, and framed tools only. Avoid nested cards.

## Interaction Rules

- Create/log/request actions open a Modal.
- View-detail actions open a Drawer.
- Destructive or financially consequential actions require Confirm Dialog.
- Every CRUD action emits a Toast.
- Data tables paginate at 5-8 rows in dashboard contexts.
- Icon buttons need `aria-label`.
- Use Tabler icons for interface actions.

## Currency

All currency is KES and must pass through `formatCompactKES()` in `src/lib/utils/format.ts` for compact display. Do not hand-roll currency strings in dashboard code.
