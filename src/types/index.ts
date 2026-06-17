export type UserRole =
  | "ceo"
  | "general_manager"
  | "bd_head"
  | "agent"
  | "property_manager"
  | "accounts_manager"
  | "accounts_officer"
  | "hr_manager"
  | "auditor";

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
