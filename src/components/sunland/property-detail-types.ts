import type { Property } from "./property-constants";

export interface OwnerInfo {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface MandatePeriod {
  collectedAmount: number;
  managementFee: number;
  approvedExpenses: number;
  landlordRemittance: number;
}

export interface ManagementMandate {
  id: string;
  status: "draft" | "pending_approval" | "active" | "terminated";
  mandateRate: number;
  startDate: string;
  currentPeriod?: MandatePeriod;
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
  tenantName: string;
  tenantPhone?: string;
  tenantEmail?: string;
  startDate: string;
  endDate?: string | null;
  status: "active" | "expiring" | "ended" | "pending_renewal";
  monthlyRentKes: string;
}

export interface MaintenanceRequestSummary {
  id: string;
  title: string;
  reportedAt: string;
  reportedBy?: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "cancelled";
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
