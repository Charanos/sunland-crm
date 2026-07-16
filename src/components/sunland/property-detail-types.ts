import type { Property } from "./property-constants";

export interface OwnerInfo {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  idNumber?: string | null;
  verifiedAt?: string | null;
  verifiedByName?: string | null;
  avatarUrl?: string | null;
}

export interface MandatePeriod {
  collectedAmount: number;
  managementFee: number;
  expenses: number;
  landlordRemittance: number;
}

export interface ManagerInfo {
  id: string;
  name?: string | null;
  title?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

export interface ManagementMandate {
  id: string;
  status: "draft" | "pending_approval" | "active" | "terminated";
  mandateRate: number;
  startDate: string;
  currentPeriod?: MandatePeriod;
  /** Only set while status is "pending_approval" - who the decision is awaiting. */
  pendingApproverRole?: "gm" | "ceo" | "department_head" | null;
  /** Only set while status is "pending_approval" - the approval_requests row to decide against. */
  approvalRequestId?: string | null;
  /** Property Manager assigned to this mandate - null when unassigned. */
  manager?: ManagerInfo | null;
}

export interface CollectionHistoryEntry {
  period: string;
  expected: number;
  collected: number;
}

export interface ArrearsInfo {
  status: "partial" | "defaulted" | "current";
  amount: number;
  daysInArrears: number;
}

export interface LeaseSummary {
  id: string;
  tenantContactId: string;
  isActive: boolean;
  tenantName: string;
  tenantPhone?: string;
  tenantEmail?: string;
  tenantAvatarUrl?: string | null;
  startDate: string;
  endDate?: string | null;
  status: "active" | "expiring" | "ended" | "pending_renewal";
  monthlyRentKes: string;
  depositKes: string | null;
}

// Priority/status mirror the DB enums (maintenance_priority /
// maintenance_status in src/db/schema/properties.ts) - the earlier
// medium/urgent/cancelled vocabulary never existed server-side.
export interface MaintenanceRequestSummary {
  id: string;
  title: string;
  reportedAt: string;
  reportedBy?: string;
  priority: "low" | "normal" | "high" | "critical";
  status: "open" | "assigned" | "in_progress" | "resolved" | "closed";
}

export interface SalesPipelineSummary {
  stage: "lead" | "viewing" | "offer" | "sale";
  leadName?: string;
  agentName?: string;
  offerAmountKes?: string | null;
  lastActivityAt?: string | null;
}

export interface PropertyDocumentSummary {
  id: string;
  name: string;
  status: "draft" | "awaiting_signature" | "signed";
  url?: string;
  type?: "mandate_letter" | "lease_agreement" | "rent_receipt" | "statement" | "title_deed" | "identification" | "offer_letter";
}

export interface ActivityLogEntry {
  id: string;
  actorName: string;
  action: string;
  occurredAt: string;
}

export interface PropertyDetail extends Property {
  owner?: OwnerInfo | null;
  mandate?: ManagementMandate | null;
  collections?: CollectionHistoryEntry[] | null;
  arrears?: ArrearsInfo | null;
  leases?: LeaseSummary[] | null;
  maintenanceRequests?: MaintenanceRequestSummary[] | null;
  salesPipeline?: SalesPipelineSummary | null;
  documents?: PropertyDocumentSummary[] | null;
  vacantSince?: string | null;
  description?: string | null;
  unitBreakdown?: Array<{ unitType: string; count: number; monthlyRentKes?: string | null }> | null;
}
