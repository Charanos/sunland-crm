export type TrendDirection = "up" | "down" | "flat";
export type DashboardTone =
  | "primary"
  | "success"
  | "warning"
  | "risk"
  | "data"
  | "neutral";

export type ExecutiveKpi = {
  id: string;
  label: string;
  value: number;
  valueType: "currency" | "number" | "percent";
  helper: string;
  trend: string;
  direction: TrendDirection;
  tone: DashboardTone;
};

export type PipelineStageSummary = {
  id: string;
  label: string;
  valueKes: number;
  leadCount: number;
  conversionRate: number;
  tone: DashboardTone;
};

export type OpportunityCard = {
  id: string;
  title: string;
  contact: string;
  property: string;
  stage: string;
  expectedValueKes: number;
  nextAction: string;
  dueLabel: string;
  ownerInitials: string;
  tone: DashboardTone;
};

export type CalendarTask = {
  id: string;
  day: number;
  title: string;
  ownerInitials: string;
  priority: "low" | "normal" | "high" | "critical";
};

export type MaintenanceItem = {
  id: string;
  title: string;
  property: string;
  priority: "low" | "normal" | "high" | "critical";
  status: "open" | "assigned" | "in_progress" | "resolved";
  daysOpen: number;
  contractor: string;
};

export type LeaseExpiry = {
  id: string;
  tenant: string;
  propertyCode: string;
  property: string;
  expiryDate: string;
  daysRemaining: number;
  rentKes: number;
};

export type ActivityItem = {
  id: string;
  actor: string;
  action: string;
  entity: string;
  timestamp: string;
  tone: DashboardTone;
};

export type TeamMemberLoad = {
  id: string;
  name: string;
  role: string;
  initials: string;
  activeDeals: number;
  tasksDue: number;
  capacity: number;
};

export type PropertySnapshot = {
  id: string;
  name: string;
  location: string;
  status: "occupied" | "available" | "under_offer" | "maintenance";
  imageUrl: string;
  monthlyRentKes?: number;
  askingPriceKes?: number;
  occupancyRate: number;
};

export type AlertItem = {
  id: string;
  title: string;
  body: string;
  tone: DashboardTone;
  href: string;
};

export type ExecutiveDashboardMock = {
  generatedAt: string;
  monthLabel: string;
  kpis: ExecutiveKpi[];
  pipelineStages: PipelineStageSummary[];
  opportunities: OpportunityCard[];
  calendarTasks: CalendarTask[];
  maintenanceQueue: MaintenanceItem[];
  leaseExpiries: LeaseExpiry[];
  activityFeed: ActivityItem[];
  teamLoad: TeamMemberLoad[];
  propertySnapshots: PropertySnapshot[];
  alerts: AlertItem[];
  finance: {
    revenueMtdKes: number;
    rentCollectedKes: number;
    rentExpectedKes: number;
    arrearsKes: number;
    commissionsPendingKes: number;
  };
};

export const executiveDashboardMock: ExecutiveDashboardMock = {
  generatedAt: "2026-06-17T10:00:00.000Z",
  monthLabel: "June 2026",
  kpis: [
    {
      id: "pipeline-value",
      label: "Pipeline value",
      value: 350_500_000,
      valueType: "currency",
      helper: "Weighted active opportunity value",
      trend: "+11% this week",
      direction: "up",
      tone: "primary",
    },
    {
      id: "rent-collection",
      label: "Rent collection",
      value: 86,
      valueType: "percent",
      helper: "Collected against expected rent",
      trend: "+4% month to date",
      direction: "up",
      tone: "success",
    },
    {
      id: "occupancy",
      label: "Occupancy",
      value: 94,
      valueType: "percent",
      helper: "Managed portfolio occupancy",
      trend: "Stable",
      direction: "flat",
      tone: "data",
    },
    {
      id: "risk-items",
      label: "Risk items",
      value: 23,
      valueType: "number",
      helper: "Arrears, expiries, and critical maintenance",
      trend: "-3 since Monday",
      direction: "down",
      tone: "warning",
    },
  ],
  pipelineStages: [
    {
      id: "qualification",
      label: "Qualification",
      valueKes: 92_350_000,
      leadCount: 34,
      conversionRate: 78,
      tone: "data",
    },
    {
      id: "viewing",
      label: "Viewing scheduled",
      valueKes: 67_120_000,
      leadCount: 21,
      conversionRate: 62,
      tone: "success",
    },
    {
      id: "offer",
      label: "Offer negotiation",
      valueKes: 28_980_000,
      leadCount: 11,
      conversionRate: 44,
      tone: "primary",
    },
    {
      id: "closed-won",
      label: "Closed won",
      valueKes: 14_600_000,
      leadCount: 7,
      conversionRate: 31,
      tone: "neutral",
    },
  ],
  opportunities: [
    {
      id: "opp-001",
      title: "Karen residence lease",
      contact: "Amina Mwangi",
      property: "Karen Ridge House",
      stage: "Viewing scheduled",
      expectedValueKes: 1_250_000,
      nextAction: "Confirm Saturday viewing",
      dueLabel: "Today",
      ownerInitials: "AM",
      tone: "data",
    },
    {
      id: "opp-002",
      title: "Runda villa sale",
      contact: "David Otieno",
      property: "Runda Grove Villa",
      stage: "Offer negotiation",
      expectedValueKes: 21_300_000,
      nextAction: "Send revised offer terms",
      dueLabel: "Tomorrow",
      ownerInitials: "DO",
      tone: "success",
    },
    {
      id: "opp-003",
      title: "Westlands office renewal",
      contact: "Nairobi Logistics Ltd",
      property: "Westlands Tower 4B",
      stage: "Legal review",
      expectedValueKes: 2_100_000,
      nextAction: "Lease addendum review",
      dueLabel: "Jun 19",
      ownerInitials: "NL",
      tone: "neutral",
    },
    {
      id: "opp-004",
      title: "Kilimani apartment rent",
      contact: "Brian Karanja",
      property: "Kilimani Unit A12",
      stage: "Deposit pending",
      expectedValueKes: 416_000,
      nextAction: "Follow up on deposit",
      dueLabel: "Jun 20",
      ownerInitials: "BK",
      tone: "primary",
    },
  ],
  calendarTasks: [
    {
      id: "task-001",
      day: 4,
      title: "Karen viewing",
      ownerInitials: "AM",
      priority: "high",
    },
    {
      id: "task-002",
      day: 11,
      title: "Rent reconciliation",
      ownerInitials: "CO",
      priority: "normal",
    },
    {
      id: "task-003",
      day: 16,
      title: "Lease renewal call",
      ownerInitials: "PM",
      priority: "high",
    },
    {
      id: "task-004",
      day: 22,
      title: "Valuation inspection",
      ownerInitials: "VN",
      priority: "critical",
    },
  ],
  maintenanceQueue: [
    {
      id: "mnt-001",
      title: "Water pressure issue",
      property: "Westlands Tower 4B",
      priority: "critical",
      status: "assigned",
      daysOpen: 9,
      contractor: "Apex Plumbing",
    },
    {
      id: "mnt-002",
      title: "Generator service",
      property: "Karen Ridge House",
      priority: "high",
      status: "in_progress",
      daysOpen: 4,
      contractor: "GridWorks",
    },
    {
      id: "mnt-003",
      title: "Lift inspection",
      property: "Kilimani Residences",
      priority: "normal",
      status: "open",
      daysOpen: 2,
      contractor: "Unassigned",
    },
  ],
  leaseExpiries: [
    {
      id: "lease-001",
      tenant: "Malaika Foods",
      propertyCode: "WL-4B",
      property: "Westlands Tower 4B",
      expiryDate: "2026-07-15",
      daysRemaining: 28,
      rentKes: 720_000,
    },
    {
      id: "lease-002",
      tenant: "Ruth Wanjiku",
      propertyCode: "KIL-A12",
      property: "Kilimani Unit A12",
      expiryDate: "2026-08-02",
      daysRemaining: 46,
      rentKes: 208_000,
    },
    {
      id: "lease-003",
      tenant: "Oasis Clinics",
      propertyCode: "UP-02",
      property: "Upper Hill Suite 02",
      expiryDate: "2026-09-10",
      daysRemaining: 85,
      rentKes: 510_000,
    },
  ],
  activityFeed: [
    {
      id: "act-001",
      actor: "Cynthia Otieno",
      action: "recorded rent payment",
      entity: "Westlands Tower 4B",
      timestamp: "10:42",
      tone: "success",
    },
    {
      id: "act-002",
      actor: "Amina Mwangi",
      action: "moved lead to viewing",
      entity: "Karen Ridge House",
      timestamp: "09:58",
      tone: "data",
    },
    {
      id: "act-003",
      actor: "Peter Mbugua",
      action: "flagged lease expiry",
      entity: "Malaika Foods",
      timestamp: "09:10",
      tone: "warning",
    },
    {
      id: "act-004",
      actor: "Valuations Desk",
      action: "uploaded draft report",
      entity: "Runda Grove Villa",
      timestamp: "08:35",
      tone: "neutral",
    },
  ],
  teamLoad: [
    {
      id: "team-001",
      name: "Amina Mwangi",
      role: "Senior Agent",
      initials: "AM",
      activeDeals: 14,
      tasksDue: 5,
      capacity: 82,
    },
    {
      id: "team-002",
      name: "Peter Mbugua",
      role: "Property Manager",
      initials: "PM",
      activeDeals: 8,
      tasksDue: 7,
      capacity: 68,
    },
    {
      id: "team-003",
      name: "Cynthia Otieno",
      role: "Accounts Officer",
      initials: "CO",
      activeDeals: 4,
      tasksDue: 11,
      capacity: 74,
    },
  ],
  propertySnapshots: [
    {
      id: "prop-001",
      name: "Karen Ridge House",
      location: "Karen",
      status: "under_offer",
      imageUrl:
        "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=80",
      askingPriceKes: 62_000_000,
      occupancyRate: 100,
    },
    {
      id: "prop-002",
      name: "Westlands Tower 4B",
      location: "Westlands",
      status: "occupied",
      imageUrl:
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80",
      monthlyRentKes: 720_000,
      occupancyRate: 96,
    },
    {
      id: "prop-003",
      name: "Kilimani Residences",
      location: "Kilimani",
      status: "maintenance",
      imageUrl:
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80",
      monthlyRentKes: 208_000,
      occupancyRate: 88,
    },
  ],
  alerts: [
    {
      id: "alert-001",
      title: "Lease expiry window",
      body: "3 leases expire within 90 days and need renewal action.",
      tone: "warning",
      href: "/admin/leases",
    },
    {
      id: "alert-002",
      title: "Critical maintenance",
      body: "Westlands Tower water pressure issue is past the 7 day threshold.",
      tone: "risk",
      href: "/admin/maintenance",
    },
    {
      id: "alert-003",
      title: "Payment received",
      body: "KES 720K rent payment recorded for Westlands Tower 4B.",
      tone: "success",
      href: "/fin",
    },
  ],
  finance: {
    revenueMtdKes: 42_800_000,
    rentCollectedKes: 36_900_000,
    rentExpectedKes: 42_900_000,
    arrearsKes: 6_000_000,
    commissionsPendingKes: 4_400_000,
  },
};
