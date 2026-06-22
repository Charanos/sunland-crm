import type { Icon } from "@tabler/icons-react";
import {
  IconBuildingBank,
  IconBuildingCommunity,
  IconCashBanknote,
  IconChartBar,
  IconClipboardCheck,
  IconCoins,
  IconFileAnalytics,
  IconHomeDollar,
  IconReceipt,
  IconReportMoney,
  IconScale,
  IconUsersGroup,
  IconWallet,
} from "@tabler/icons-react";

export type FinanceSectionId =
  | "overview"
  | "ledger"
  | "rentals"
  | "mandates"
  | "payroll"
  | "ap-ar"
  | "cheques"
  | "fees"
  | "affordable-housing"
  | "reports";

export type FinanceTab = {
  id: string;
  label: string;
  href: string;
  attention?: number;
};

export type FinanceSection = {
  id: FinanceSectionId;
  label: string;
  title: string;
  description: string;
  href: string;
  icon: Icon;
  groupId: FinanceGroupId;
  attention?: number;
  tabs: FinanceTab[];
};

export type FinanceGroupId =
  | "command"
  | "core-accounting"
  | "property-revenue"
  | "treasury-control"
  | "people-statutory"
  | "assurance";

export type FinanceGroup = {
  id: FinanceGroupId;
  label: string;
  title: string;
  description: string;
  icon: Icon;
  sectionIds: FinanceSectionId[];
};

export const financeSections: FinanceSection[] = [
  {
    id: "overview",
    label: "Overview",
    title: "Finance Command",
    description:
      "Entity-scoped finance control room for cash position, approvals, collections, and recent financial activity.",
    href: "/fin",
    icon: IconChartBar,
    groupId: "command",
    tabs: [],
  },
  {
    id: "ledger",
    label: "Ledger & Accounts",
    title: "Ledger & Accounts",
    description:
      "Double-entry journals, chart of accounts, trial balance, and statement views for the active entity.",
    href: "/fin/ledger/journal-entries",
    icon: IconWallet,
    groupId: "core-accounting",
    attention: 1,
    tabs: [
      { id: "journal-entries", label: "Journal Entries", href: "/fin/ledger/journal-entries", attention: 1 },
      { id: "chart-of-accounts", label: "Chart of Accounts", href: "/fin/ledger/chart-of-accounts" },
      { id: "trial-balance", label: "Trial Balance", href: "/fin/ledger/trial-balance" },
      { id: "balance-sheet", label: "Balance Sheet", href: "/fin/ledger/balance-sheet" },
      { id: "cash-flow", label: "Cash Flow", href: "/fin/ledger/cash-flow" },
    ],
  },
  {
    id: "rentals",
    label: "Rentals",
    title: "Rentals Ledger",
    description:
      "Expected rent, actual collections, deficits, vacancies, and defaulter aging for managed units.",
    href: "/fin/rentals/collections",
    icon: IconHomeDollar,
    groupId: "property-revenue",
    attention: 12,
    tabs: [
      { id: "collections", label: "Collections", href: "/fin/rentals/collections" },
      { id: "deficits", label: "Deficits", href: "/fin/rentals/deficits", attention: 4 },
      { id: "vacancies", label: "Vacancies", href: "/fin/rentals/vacancies", attention: 3 },
      { id: "defaulters", label: "Defaulters", href: "/fin/rentals/defaulters", attention: 5 },
    ],
  },
  {
    id: "mandates",
    label: "Mandates",
    title: "Property Mandates",
    description:
      "Mandate terms, approval status, collections, expenses, and landlord remittance readiness.",
    href: "/fin/mandates/active",
    icon: IconClipboardCheck,
    groupId: "property-revenue",
    attention: 3,
    tabs: [
      { id: "active", label: "Active", href: "/fin/mandates/active" },
      { id: "pending-approval", label: "Pending Approval", href: "/fin/mandates/pending-approval", attention: 3 },
      { id: "draft", label: "Draft", href: "/fin/mandates/draft" },
      { id: "terminated", label: "Terminated", href: "/fin/mandates/terminated" },
    ],
  },
  {
    id: "payroll",
    label: "Payroll",
    title: "Payroll",
    description:
      "Payroll runs, payslip previews, statutory remittances, and GM approval handoff.",
    href: "/fin/payroll/runs",
    icon: IconUsersGroup,
    groupId: "people-statutory",
    tabs: [
      { id: "runs", label: "Runs", href: "/fin/payroll/runs" },
      { id: "payslips", label: "Payslips", href: "/fin/payroll/payslips" },
      { id: "remittances", label: "Remittances", href: "/fin/payroll/remittances" },
    ],
  },
  {
    id: "ap-ar",
    label: "Payables & Receivables",
    title: "Payables & Receivables",
    description:
      "Vendor obligations, client invoices, due-date aging, receipts, and payment recording.",
    href: "/fin/ap-ar/payables",
    icon: IconReceipt,
    groupId: "treasury-control",
    attention: 2,
    tabs: [
      { id: "payables", label: "Payables", href: "/fin/ap-ar/payables", attention: 1 },
      { id: "receivables", label: "Receivables", href: "/fin/ap-ar/receivables", attention: 1 },
    ],
  },
  {
    id: "cheques",
    label: "Cheques",
    title: "Banker's Cheques",
    description:
      "Deposited, credited, and returned cheque verification with ledger posting only on credit confirmation.",
    href: "/fin/cheques/deposited",
    icon: IconBuildingBank,
    groupId: "treasury-control",
    attention: 1,
    tabs: [
      { id: "deposited", label: "Deposited", href: "/fin/cheques/deposited", attention: 1 },
      { id: "credited", label: "Credited", href: "/fin/cheques/credited" },
      { id: "returned", label: "Returned", href: "/fin/cheques/returned" },
    ],
  },
  {
    id: "fees",
    label: "Service Fees",
    title: "Service Fees",
    description:
      "Fee rules and charge logs for letting fees, lease fees, late fees, sales commissions, and valuations.",
    href: "/fin/fees/rules",
    icon: IconCashBanknote,
    groupId: "property-revenue",
    tabs: [
      { id: "rules", label: "Fee Rules", href: "/fin/fees/rules" },
      { id: "charges", label: "Charges Log", href: "/fin/fees/charges" },
    ],
  },
  {
    id: "affordable-housing",
    label: "Affordable Housing",
    title: "Affordable Housing",
    description:
      "Scheme units, allocations, and Affordable Housing Levy compliance sourced from payroll.",
    href: "/fin/affordable-housing/units",
    icon: IconBuildingCommunity,
    groupId: "people-statutory",
    tabs: [
      { id: "units", label: "Units", href: "/fin/affordable-housing/units" },
      { id: "allocations", label: "Allocations", href: "/fin/affordable-housing/allocations" },
      { id: "levy", label: "Levy", href: "/fin/affordable-housing/levy" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    title: "Finance Reports",
    description:
      "Generated statements, report library, and QR verification for finance artifacts.",
    href: "/fin/reports/generate",
    icon: IconFileAnalytics,
    groupId: "assurance",
    tabs: [
      { id: "generate", label: "Generate", href: "/fin/reports/generate" },
      { id: "library", label: "Library", href: "/fin/reports/library" },
      { id: "verify", label: "Verify", href: "/fin/reports/verify" },
    ],
  },
];

export const financeGroups: FinanceGroup[] = [
  {
    id: "command",
    label: "Command",
    title: "Finance Command Overview",
    description: "Cross-finance operating picture, daily alerts, quick actions, and activity signals.",
    icon: IconChartBar,
    sectionIds: ["overview"],
  },
  {
    id: "core-accounting",
    label: "Core Accounting",
    title: "Accounting Control Hub",
    description: "General ledger, accounts, trial balance, balance sheet, and cash-flow statements.",
    icon: IconWallet,
    sectionIds: ["ledger"],
  },
  {
    id: "property-revenue",
    label: "Property Revenue",
    title: "Property Revenue Hub",
    description: "Rentals, mandate performance, defaulters, service fees, and landlord remittance drivers.",
    icon: IconHomeDollar,
    sectionIds: ["rentals", "mandates", "fees"],
  },
  {
    id: "treasury-control",
    label: "Treasury Control",
    title: "Treasury Control Hub",
    description: "Payables, receivables, cheque verification, liquidity control, and working-capital queues.",
    icon: IconBuildingBank,
    sectionIds: ["ap-ar", "cheques"],
  },
  {
    id: "people-statutory",
    label: "People & Statutory",
    title: "People & Statutory Hub",
    description: "Payroll, remittances, payslips, Affordable Housing levy, and compliance obligations.",
    icon: IconUsersGroup,
    sectionIds: ["payroll", "affordable-housing"],
  },
  {
    id: "assurance",
    label: "Assurance",
    title: "Reporting & Assurance Hub",
    description: "Generated financial reports, QR verification, libraries, and audit-ready artifacts.",
    icon: IconFileAnalytics,
    sectionIds: ["reports"],
  },
];

export const financeSectionById = Object.fromEntries(
  financeSections.map((section) => [section.id, section]),
) as Record<FinanceSectionId, FinanceSection>;

export const financeGroupById = Object.fromEntries(
  financeGroups.map((group) => [group.id, group]),
) as Record<FinanceGroupId, FinanceGroup>;

export function findFinanceSection(pathname: string) {
  return (
    financeSections
      .filter((section) =>
        section.id === "overview" ? pathname === section.href : pathname.startsWith(`/fin/${section.id}`),
      )
      .sort((a, b) => b.href.length - a.href.length)[0] ?? financeSectionById.overview
  );
}

export function findFinanceTab(section: FinanceSection, pathname: string) {
  return section.tabs.find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));
}

export function isFinanceTab(sectionId: FinanceSectionId, tabId: string) {
  return financeSectionById[sectionId].tabs.some((tab) => tab.id === tabId);
}

export type FinanceScaffoldMetric = {
  label: string;
  value: string;
  tone: "brand" | "success" | "warning" | "data" | "neutral";
  progress: number;
  icon: Icon;
  trend?: string;
};

export type FinanceTableRow = {
  ref: string;
  subject: string;
  detail: string;
  amount: number;
  status: "Posted" | "Pending" | "Approved" | "Overdue" | "Draft" | "Returned" | "Credited" | "Vacant";
  date: string;
};

export const financeTabScaffold: Record<FinanceSectionId, {
  metrics: FinanceScaffoldMetric[];
  columns: string[];
  rows: FinanceTableRow[];
}> = {
  overview: {
    metrics: [],
    columns: [],
    rows: [],
  },
  ledger: {
    metrics: [
      { label: "Posted Journals", value: "42", tone: "brand", progress: 72, icon: IconReportMoney, trend: "+8 this month" },
      { label: "Trial Balance", value: "0", tone: "success", progress: 100, icon: IconScale, trend: "variance" },
      { label: "Draft Entries", value: "3", tone: "warning", progress: 35, icon: IconClipboardCheck },
      { label: "Cash Accounts", value: "8", tone: "data", progress: 58, icon: IconBuildingBank },
    ],
    columns: ["Reference", "Memo", "Amount", "Status", "Date"],
    rows: [
      { ref: "JE-0042", subject: "Management fee recognition", detail: "June collections batch", amount: 840000, status: "Posted", date: "2026-06-20" },
      { ref: "JE-0041", subject: "Landlord payable clearing", detail: "Residential remittance cycle", amount: 4260000, status: "Posted", date: "2026-06-19" },
      { ref: "JE-0040", subject: "Statutory remittance accrual", detail: "Payroll deductions", amount: 612000, status: "Pending", date: "2026-06-18" },
      { ref: "JE-0039", subject: "Valuation fee invoice", detail: "Sunland Valuers Ltd", amount: 185000, status: "Draft", date: "2026-06-17" },
    ],
  },
  rentals: {
    metrics: [
      { label: "Collection Rate", value: "91.4%", tone: "success", progress: 91, icon: IconCoins, trend: "+2.1%" },
      { label: "Expected Rent", value: "KES 9.8M", tone: "brand", progress: 78, icon: IconHomeDollar },
      { label: "Deficits", value: "KES 840K", tone: "warning", progress: 38, icon: IconReceipt },
      { label: "90+ Arrears", value: "5", tone: "data", progress: 24, icon: IconClipboardCheck },
    ],
    columns: ["Unit", "Tenant / Property", "Amount", "Status", "Period"],
    rows: [
      { ref: "SL-R-018", subject: "Apt 4B, Westpoint", detail: "Tenant: Mary W.", amount: 125000, status: "Posted", date: "2026-06" },
      { ref: "SL-R-021", subject: "Shop 12, Kilimani", detail: "Tenant: Quick Logistics", amount: 45000, status: "Overdue", date: "2026-06" },
      { ref: "SL-R-044", subject: "Unit C7, Riverside", detail: "Tenant: Global Trade", amount: 180000, status: "Pending", date: "2026-06" },
      { ref: "SL-R-050", subject: "Warehouse 3", detail: "Vacancy follow-up", amount: 0, status: "Vacant", date: "2026-06" },
    ],
  },
  mandates: {
    metrics: [
      { label: "Active Mandates", value: "28", tone: "brand", progress: 64, icon: IconClipboardCheck },
      { label: "Pending Approval", value: "3", tone: "warning", progress: 30, icon: IconScale },
      { label: "Mgmt Fees", value: "KES 840K", tone: "success", progress: 76, icon: IconCoins },
      { label: "Remittance Queue", value: "KES 4.2M", tone: "data", progress: 55, icon: IconReportMoney },
    ],
    columns: ["Mandate", "Landlord / Property", "Amount", "Status", "Start"],
    rows: [
      { ref: "MAN-1028", subject: "Nakuru Villas", detail: "12 units, standard 10% rate", amount: 620000, status: "Pending", date: "2026-06-15" },
      { ref: "MAN-1027", subject: "Hurlingham Court", detail: "8 units, active", amount: 480000, status: "Approved", date: "2026-06-01" },
      { ref: "MAN-1026", subject: "Riverside Annex", detail: "Expense awaiting GM", amount: 76000, status: "Pending", date: "2026-05-28" },
      { ref: "MAN-1025", subject: "Valuers commercial block", detail: "Draft terms", amount: 0, status: "Draft", date: "2026-05-18" },
    ],
  },
  payroll: {
    metrics: [
      { label: "Current Run", value: "KES 2.8M", tone: "brand", progress: 80, icon: IconUsersGroup },
      { label: "Statutory Due", value: "KES 612K", tone: "warning", progress: 42, icon: IconReceipt },
      { label: "Payslips", value: "36", tone: "data", progress: 66, icon: IconFileAnalytics },
      { label: "Disbursed", value: "1", tone: "success", progress: 100, icon: IconBuildingBank },
    ],
    columns: ["Run", "Department / Body", "Amount", "Status", "Period"],
    rows: [
      { ref: "PAY-2026-06", subject: "June payroll", detail: "Awaiting GM disbursement", amount: 2800000, status: "Pending", date: "2026-06" },
      { ref: "NSSF-2026-06", subject: "NSSF remittance", detail: "Statutory schedule", amount: 98000, status: "Draft", date: "2026-06" },
      { ref: "PAYE-2026-06", subject: "KRA PAYE", detail: "Statutory schedule", amount: 384000, status: "Draft", date: "2026-06" },
      { ref: "PAY-2026-05", subject: "May payroll", detail: "Disbursed", amount: 2710000, status: "Approved", date: "2026-05" },
    ],
  },
  "ap-ar": {
    metrics: [
      { label: "Payables", value: "KES 1.6M", tone: "warning", progress: 44, icon: IconReceipt },
      { label: "Receivables", value: "KES 1.95M", tone: "brand", progress: 62, icon: IconReportMoney },
      { label: "Net Position", value: "KES 350K", tone: "success", progress: 58, icon: IconScale },
      { label: "Overdue Count", value: "2", tone: "data", progress: 20, icon: IconClipboardCheck },
    ],
    columns: ["Reference", "Vendor / Client", "Amount", "Status", "Due"],
    rows: [
      { ref: "BILL-118", subject: "Contractor invoice", detail: "Lift maintenance", amount: 340000, status: "Pending", date: "2026-06-25" },
      { ref: "INV-204", subject: "Valuation client", detail: "Commercial valuation", amount: 185000, status: "Overdue", date: "2026-06-10" },
      { ref: "BILL-117", subject: "Security services", detail: "Managed properties", amount: 420000, status: "Approved", date: "2026-06-22" },
      { ref: "INV-203", subject: "Lease fee", detail: "New commercial lease", amount: 95000, status: "Pending", date: "2026-06-30" },
    ],
  },
  cheques: {
    metrics: [
      { label: "Deposited", value: "7", tone: "warning", progress: 46, icon: IconBuildingBank },
      { label: "Credited", value: "18", tone: "success", progress: 76, icon: IconReceipt },
      { label: "Returned", value: "1", tone: "data", progress: 18, icon: IconClipboardCheck },
      { label: "Over Threshold", value: "1", tone: "brand", progress: 25, icon: IconScale },
    ],
    columns: ["Cheque", "Payer", "Amount", "Status", "Deposited"],
    rows: [
      { ref: "CHQ-0098", subject: "Global Trade Inc", detail: "Awaiting bank confirmation", amount: 640000, status: "Pending", date: "2026-06-18" },
      { ref: "CHQ-0097", subject: "Nairobi Retailers", detail: "Credited and posted", amount: 120000, status: "Credited", date: "2026-06-17" },
      { ref: "CHQ-0096", subject: "Quick Logistics", detail: "Returned, follow-up queued", amount: 45000, status: "Returned", date: "2026-06-15" },
      { ref: "CHQ-0095", subject: "Acme Corp Ltd", detail: "Credited and posted", amount: 450000, status: "Credited", date: "2026-06-12" },
    ],
  },
  fees: {
    metrics: [
      { label: "Active Rules", value: "12", tone: "brand", progress: 70, icon: IconCashBanknote },
      { label: "Charges", value: "KES 430K", tone: "success", progress: 64, icon: IconReceipt },
      { label: "Pending Posting", value: "4", tone: "warning", progress: 32, icon: IconClipboardCheck },
      { label: "Streams", value: "5", tone: "data", progress: 80, icon: IconReportMoney },
    ],
    columns: ["Rule / Charge", "Scope", "Amount", "Status", "Date"],
    rows: [
      { ref: "FEE-R-01", subject: "Letting fee", detail: "Percentage rule", amount: 0, status: "Approved", date: "Active" },
      { ref: "FEE-C-88", subject: "Late fee", detail: "Tenant charge", amount: 12000, status: "Pending", date: "2026-06-20" },
      { ref: "FEE-C-87", subject: "Valuation fee", detail: "Client charge", amount: 185000, status: "Posted", date: "2026-06-18" },
      { ref: "FEE-R-02", subject: "Sales commission", detail: "Percentage rule", amount: 0, status: "Approved", date: "Active" },
    ],
  },
  "affordable-housing": {
    metrics: [
      { label: "Scheme Units", value: "14", tone: "brand", progress: 54, icon: IconBuildingCommunity },
      { label: "Allocations", value: "8", tone: "success", progress: 57, icon: IconHomeDollar },
      { label: "Levy Due", value: "KES 84K", tone: "warning", progress: 39, icon: IconReceipt },
      { label: "CEO Gates", value: "1", tone: "data", progress: 20, icon: IconScale },
    ],
    columns: ["Record", "Scheme / Payroll", "Amount", "Status", "Period"],
    rows: [
      { ref: "AHU-014", subject: "Kiambu programme unit", detail: "CEO approval gate", amount: 0, status: "Pending", date: "2026-06" },
      { ref: "AHL-2026-06", subject: "Affordable Housing Levy", detail: "Payroll-sourced", amount: 84000, status: "Draft", date: "2026-06" },
      { ref: "AHA-008", subject: "Allocation record", detail: "Eligibility complete", amount: 0, status: "Approved", date: "2026-06-11" },
      { ref: "AHU-013", subject: "Managed programme unit", detail: "Active", amount: 0, status: "Approved", date: "2026-05" },
    ],
  },
  reports: {
    metrics: [
      { label: "Generated", value: "24", tone: "brand", progress: 68, icon: IconFileAnalytics },
      { label: "Verified", value: "9", tone: "success", progress: 46, icon: IconClipboardCheck },
      { label: "Pending Export", value: "2", tone: "warning", progress: 22, icon: IconReceipt },
      { label: "Report Types", value: "5", tone: "data", progress: 80, icon: IconReportMoney },
    ],
    columns: ["Report", "Scope", "Amount", "Status", "Generated"],
    rows: [
      { ref: "RPT-208", subject: "Balance Sheet", detail: "Sunland Group", amount: 0, status: "Posted", date: "2026-06-20" },
      { ref: "RPT-207", subject: "Mandate Statement", detail: "MAN-1027", amount: 480000, status: "Posted", date: "2026-06-19" },
      { ref: "RPT-206", subject: "Payroll Summary", detail: "June draft", amount: 2800000, status: "Pending", date: "2026-06-18" },
      { ref: "RPT-205", subject: "Trial Balance", detail: "Sunland Residential", amount: 0, status: "Posted", date: "2026-06-15" },
    ],
  },
};
