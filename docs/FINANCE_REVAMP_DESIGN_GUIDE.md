# Finance Revamp Design & Implementation Guide

This guide establishes the visual, typography, and functional contract for revamping the sub-pages of the **Finance Module** (Ledger, Rentals, Mandates, Payroll, AP/AR, Cheques, Fees, Reports). It ensures that all sub-pages match the high aesthetic quality, density, and functional robustness of the consolidated Finance Overview.

---

## 1. Visual & Aesthetic Standards

Every sub-page must feel dense, premium, and structured. Do not use generic layouts or floating elements.

### 1.1 Section Structures & Spacing
- Use clear lines (`border-t border-slate-200/60`) to separate distinct sections.
- Titles must reside **outside** of content cards. This establishes a clean visual hierarchy.
  ```tsx
  <div className="pt-6 border-t border-slate-200/60 my-4">
    <h2 className="title-serif text-slate-900 text-[22px] font-normal">Section Title</h2>
    <p className="text-[12.5px] text-slate-500 font-medium tracking-wide mt-1">
      Clear explanation of what this section monitors and details.
    </p>
  </div>
  ```
- App backgrounds use the **Warm Workspace** tone (`#f4f6f0`). Cards use white surfaces (`#ffffff`) with an `8px` or `12px` border radius (`rounded-xl` or `rounded-2xl`).

### 1.2 Strict Typography Rules
- **Font-Weight Cap:** The project strictly prohibits `font-semibold` or `font-bold` (capped at font weights of 500 / `font-medium`). Use text size, color contrast (e.g. `text-slate-900` vs `text-slate-500`), letter-spacing, and casing to create visual hierarchy.
- **Serif Accents:** All page and section headings use the `title-serif` style (Cormorant Garamond, `font-normal` / 300).
- **Interface Text:** Body, labels, and generic text use figtree.
- **Monospace Figures:** All KES currency values, dates, percentages, transactional reference IDs (e.g. `JE-0042`, `MDT-109`), cheque numbers, and ticket hashes must use JetBrains Mono (`font-mono`).

---

## 2. Table & Grid Design

Tables are the operational surface of the ERP and must follow these standards:
- **Pagination Boundary:** Dashboard tables are capped at **5 to 8 rows per page**. Never allow tables to extend infinitely. Use the global `<PaginationControls>` component.
- **Row Actions:** Interactive row actions must reside in a `...` vertical menu (`IconDotsVertical`) at the far right.
- **Drawer Detail Targets:** Clicking a row or a primary record reference must slide open a right-hand detail `<Drawer>` containing full history and related logs rather than navigating the user away.
- **Empty States:** When a table contains no rows, render the `<EmptyState>` primitive featuring a single role-appropriate action (e.g., "Add Journal Entry" or "Clear Filter").

---

## 3. Form Validation & Ledger Rules

Finance actions govern money; therefore, forms must feature rigid validations:
- **Balanced Ledgers:** Double-entry journal entry forms require that the sum of debits exactly equals the sum of credits.
  - Enforce this client-side using a React Hook Form + Zod `.refine()` block.
  - Enforce it server-side within the API endpoint handler.
  - Render an inline alert indicator summarizing the discrepancy if debits and credits do not balance.
- **Deviation Logs:** The standard property management commission rate is 10%. If a mandate rate deviates, require the user to input a detailed justification reason.
- **Action Triggers:** Successful submissions must emit a Toast notification (via `<ToastProvider>`), close the active Modal/Drawer, and trigger a data refetch (via TanStack Query invalidate or real-time Pusher events).

---

## 4. Policy Thresholds & Approvals

Finance coordinates with the shared ERP Approval Engine. Gating rules must check the transaction amounts:
- **Banker's Cheques:** Cheques at or below KES 500,000 are auto-credited immediately. Cheques exceeding KES 500,000 trigger a hold policy, setting the status to "Pending Approval" (amber badge) and routing a request to the GM/CEO.
- **Mandate Volumes:** Mandates representing portfolios with more than 10 units are automatically marked as "Pending Approval" and require GM sign-off before rental ledger tracking is unlocked.
- **Property Petty Cash:** Petty cash expenses logged by Line Managers require GM/CEO approvals if they exceed KES 5,000.
- **Rejection Enforcements:** Rejections from GM/CEO roles are prohibited without a mandatory justification note, which is recorded in the transaction's audit log.

---

## 5. Audit Trails & Activity Logs

Every detail drawer (Journal, Mandate, Cheque, Payroll, AP/AR) must feature a chronological **Activity Log** section:
- Renders events oldest-to-newest from bottom to top, or newest-to-oldest with clear timestamps.
- Records: creator, date, actions (created, updated, approved, rejected, voided), and decision notes.
- This creates an immutable audit trail, making robustness verifiable.
