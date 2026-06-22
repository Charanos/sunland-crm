# State Management Guidelines

Sunland ERP uses a strict separation of local UI state, global UI state, server state, and form state.

## Global UI State

Use Zustand only for app-wide UI concerns:

- Active entity context.
- Sidebar collapse/open state.
- Entity switching transition state.
- Global drawer/modal orchestration only when a feature truly crosses route boundaries.

The canonical entity context is `useUIStore` in `src/store/ui.ts`. Department dashboards read `activeEntityId`; they do not create their own entity switcher or entity store.

## Local Component State

Use local React state for:

- Active dashboard tab.
- Open row action menu.
- Current page for small dashboard tables.
- Modal/drawer open state when scoped to a single component.

Derived state should be computed during render or with `useMemo`. Do not use `useEffect` to copy props into local state unless the component is integrating with an external imperative API.

## Server State

Use TanStack Query for server-derived records:

- Query keys include department, resource, active entity, and filters.
- Mutations invalidate or update the exact affected query keys.
- Tables over 200 rows use server-side filtering and pagination.
- Dashboard aggregate queries may refresh in the background; data-entry tables should refresh by explicit user action.

## URL State

Use `nuqs` for state that should survive reloads or be shareable:

- Table page.
- Sort.
- Filters.
- Active resource tab.

Do not put transient drawer or modal state in the URL unless the drawer is intentionally addressable.

## Approval State

Any workflow named in the ERP spec Section 4 or Section 4.7 writes to `approval_requests` and waits for server-side approval enforcement. Client state may show optimistic queue movement, but server state is the authority.

## Realtime State

Realtime events are notifications of server changes, not the source of truth. On a Pusher/Ably event, invalidate the relevant TanStack Query key and let the query refetch authoritative data.
