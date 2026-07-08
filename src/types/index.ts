export type UserRole =
  | "ceo"
  | "general_manager"
  | "finance_head" | "accounts_manager"
  | "finance_officer" | "accounts_officer"
  | "rentals_officer" | "rentals_mandates_officer"
  | "payroll_officer"
  | "hr_head"
  | "hr_officer"
  | "front_office_head"
  | "front_office_admin"
  | "driver"
  | "operations_lead" | "property_manager"
  | "valuer"
  | "auditor" | "auditor_compliance";

export type PipelineStage =
  | "inquiry"
  | "qualification"
  | "viewing"
  | "offer"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export type NotificationType =
  | "lead"
  | "payment"
  | "maintenance"
  | "lease"
  | "system";

export type SunlandNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  href?: string;
  readAt?: string;
  createdAt: string;
};
