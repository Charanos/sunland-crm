# Sunland CRM — Operations Module Implementation Spec

> This document serves as the implementation blueprint for the **Operations & Maintenance Module** of the Sunland CRM. It carries forward the exact design language, logic paradigms, and structural rigor established in the Executive Overview.

## 1. Module Overview
The Operations module is responsible for managing day-to-day physical maintenance, compliance audits, contractor scheduling, and unit turnovers. 

**Target Pages/Sub-routes:**
- `/admin/maintenance` (or `/admin/ops`)

## 2. Design & Aesthetics Carry-Over

### 2.1 Color Palette Standardization
The operations pages must strictly adhere to the updated hybrid palette:
- **Primary Actions:** Sunland Yellow (`bg-[#f3df27]`) with Navy text (`text-[#151936]`) and hover (`hover:bg-[#e6d220]`). This is used for "Log Maintenance", "Assign Contractor", etc.
- **Brand Dark (Sidebar Blue):** `bg-[#151936]`, `text-[#151936]`, `border-[#151936]`. Used for active tabs, section headers, pagination, and primary chart elements. **Do not use the legacy teal (`#15464e`).**
- **Semantic Accents:** Keep the `bg-emerald-500/20 text-emerald-300` for "Resolved", `bg-rose-500/20 text-rose-300` for "Critical/Overdue".

### 2.2 Typography Rules
- **No Rogue Font Weights:** Do not use `font-medium`, `font-semibold`, or `font-bold` randomly.
- **Serif Headers:** `title-serif` (Cormorant Garamond, `font-light` / `font-weight: 300`) for top-level page and section titles.
- **Data & Currency:** `font-mono` (JetBrains Mono) for all KES amounts, dates, and ticket IDs.

### 2.3 Currency Standardization
- All financial metrics (repair costs, contractor invoices, budgets) must be strictly formatted as **KES** (e.g. `KES 45,000` or `KES 1.2M`). 

## 3. Component Architecture & State Management

### 3.1 The Hybrid Board Layout
The operations view will emulate the `UnifiedMarketBoard` structure:
- **Top Unified Header:** Title, subtitle, segmented filter pills (e.g. "All Tickets", "Plumbing", "Electrical", "Structural"), and a global search bar.
- **Analytics Tier (Top Row):** 3-4 KPI cards detailing Monthly Repair Costs, Open Ticket counts, and Contractor Performance.
- **Data Tier (Bottom Grid/Table):** A list or grid of maintenance tickets and operational tasks.

### 3.2 Modals & Drawers Paradigm
We will carry over the exact Drawer/Modal pattern used in the dashboard:
- **Form Modals (`MaintenanceFormModal`):** Slide-up center modals with Zod + React Hook Form validation for creating new maintenance tickets or contractor assignments.
- **Detail Drawers (`TicketDetailDrawer`):** Slide-in right-side panels that open when a user clicks an operational ticket. It will show the full history, attached photos of damage, contractor chat, and state-change actions (Resolve, Escalate).

### 3.3 State Management Principles
- **No Cascading Effects:** Avoid `useEffect` for syncing state from props. Use derived state during render (`prevContext` tracking) as implemented in `dashboard-overview.tsx`.
- **Toast Integration:** Every CRUD action (resolving a ticket, assigning a contractor) must trigger the global `useToast` system for immediate visual feedback.

## 4. Required Components to Build

1. `operations-board.tsx`: The main page layout containing the tabs, filters, and analytics cards.
2. `maintenance-ticket-drawer.tsx`: The detailed side-panel for individual work orders.
3. `log-ticket-modal.tsx`: The modal to create a new maintenance request.
4. `contractor-list.tsx`: A dense UI table displaying active vendors and their current assigned tasks.

## 5. Verification Checklist
- [ ] Are all primary buttons `bg-[#f3df27]` with `text-[#151936]`?
- [ ] Is `#151936` used as the primary dark theme color?
- [ ] Are all financial metrics formatted as KES?
- [ ] Are font weights restricted strictly to the defined scales?
- [ ] Does clicking a ticket open a Drawer?
- [ ] Does creating a ticket open a Modal?
- [ ] Do actions trigger Toasts?
