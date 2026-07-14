"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  IconArrowUpRight,
  IconBuildingSkyscraper,
  IconCoin,
  IconTrendingUp,
  IconTrendingDown,
  IconWallet,
  IconChartLine,
  IconPlus,
  IconDotsVertical,
  IconSearch,
  IconChevronLeft,
  IconChevronRight,
  IconArrowRight,
  IconRefresh,
  IconEye,
  IconEdit,
  IconTrash,
  IconStatusChange,
  IconPhone,
  IconCalendarEvent,
  IconActivity,
  IconReceipt,
  IconInbox,
  IconFileText,
  IconCheck,
  IconBriefcase,
} from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils/cn";
import { formatCompactKES } from "@/lib/utils/format";
import { useToast } from "@/components/ui/toast-provider";
import { PageTransition } from "@/components/shared/page-transition";
import { PropertyFormModal } from "./property-form-modal";
import { PropertyDetailDrawer } from "./property-detail-drawer";
import { ApprovalQueue } from "./approval-queue";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

// Dynamically import client-side chart and helper components with SSR disabled
const SalesChart = dynamic(() => import("./sales-chart"), { ssr: false });
const RadialProgress = dynamic(() => import("./radial-progress"), {
  ssr: false,
});
const GrowthWidget = dynamic(() => import("./growth-widget"), { ssr: false });
const UnifiedMarketBoard = dynamic(
  () =>
    import("./unified-market-board").then((m) => ({
      default: m.UnifiedMarketBoard,
    })),
  { ssr: false },
);
const InternalOperationsBoard = dynamic(
  () =>
    import("./internal-operations-board").then((m) => ({
      default: m.InternalOperationsBoard,
    })),
  { ssr: false },
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface PropertyListing {
  id: string;
  name: string;
  location: string;
  type: string;
  status: "Available" | "Sold" | "Under Offer" | "Occupied";
  roi: string;
  price: string;
  imageUrl: string | null;
}

interface DashboardStats {
  totalProperties: number;
  totalPropertiesTrend: number;
  occupancyRate: number;
  occupiedProperties: number;
  rentPool: number;
  expiringLeases30d: number;
  incomeKes: number;
  incomeTrend: number;
  expensesKes: number;
  expensesTrend: number;
  profitKes: number;
  profitTrend: number;
  closedDealsCount: number;
  closedDealsTrend: number;
  activePipelineCount: number;
  newLeadsCount: number;
  newLeadsTrend: number;
  propertyInquiriesCount: number;
  conversionRate: number;
  chartSeries: Array<{
    day: string;
    Revenue: number;
    Transactions: number;
    Leads: number;
  }>;
  recentListings: PropertyListing[];
  activityLogs: ActivityLogItem[];
  awaitingMyDecision: {
    count: number;
    items: Array<{
      id: string;
      requestType: string;
      amountKes: number | null;
      requestedAt: string;
      relatedTable: string;
    }>;
  };
  systemHealth: {
    activeUserCount: number;
    lastThresholdChangeAt: string | null;
  } | null;
  departmentStats: {
    sales: number;
    ops: number;
    legal: number;
  };
}

interface ActivityLogItem {
  id: string;
  time: string;
  text: string;
  type: "call" | "viewing" | "payment" | "update" | "system";
  icon: "phone" | "eye" | "receipt" | "edit" | "activity";
}

// ─── Data Registry ────────────────────────────────────────────────────────────

const LOG_ICONS = {
  phone: IconPhone,
  eye: IconEye,
  receipt: IconReceipt,
  edit: IconEdit,
  activity: IconActivity,
};

const STATUS_DARK_TONES = {
  Available: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Sold: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "Under Offer": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  Occupied: "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

const TABLE_STATUS_STYLES: Record<string, string> = {
  Available: "bg-[#e6f4ea] text-[#1b431e]",
  Occupied: "bg-[#eef2f6] text-[#24354a]",
  "Under Offer": "bg-[#fcf0e4] text-[#5e2b17]",
  Sold: "bg-slate-100 text-slate-600",
};

const ROWS_PER_PAGE = 5;

// ─── Main Component ───────────────────────────────────────────────────────────

export function DashboardOverview({
  entityId = "group",
}: {
  entityId?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const { pushToast } = useToast();

  // Entity context
  const context =
    entityId === "commercial" || entityId === "residential"
      ? entityId
      : "group";

  // Listing Board state
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [activeTab, setActiveTab] = useState<
    "listings" | "activity" | "transactions"
  >("listings");
  const [listingSearch, setListingSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<keyof PropertyListing | null>(
    null,
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [rowMenuOpen, setRowMenuOpen] = useState<string | null>(null);

  // CRUD state
  const [propertyModalOpen, setPropertyModalOpen] = useState(false);
  const [propertyModalMode, setPropertyModalMode] = useState<"create" | "edit">(
    "create",
  );
  const [editingProperty, setEditingProperty] =
    useState<PropertyListing | null>(null);
  const [drawerProperty, setDrawerProperty] = useState<PropertyListing | null>(
    null,
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Revenue chart state
  const [chartFilter, setChartFilter] = useState<
    "all" | "Revenue" | "Transactions" | "Leads"
  >("all");
  const [chartPeriod, setChartPeriod] = useState<"week" | "month" | "quarter">(
    "week",
  );

  // Last refreshed
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Backend stats state
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    Promise.resolve().then(() => setIsRefreshing(true));
    try {
      const params = new URLSearchParams({ period: chartPeriod });
      if (context !== "group") params.append("entityId", context);
      const res = await fetch(`/api/dashboard/overview?${params.toString()}`);
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to load dashboard stats");
      setStats(data);
      if (data.recentListings) {
        setListings(data.recentListings);
      }
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Failed to load dashboard overview:", err);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [context, chartPeriod]);

  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.user?.role) {
          setCurrentUserRole(data.user.role);
        }
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) loadDashboardData();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadDashboardData]);

  // Context metrics (KES standardized)
  const isComm = context === "commercial";
  const isRes = context === "residential";

  const formatTrend = (value: number) => `${value > 0 ? "+" : ""}${value}%`;

  const metrics = {
    activeListings: stats ? stats.totalProperties.toString() : "0",
    activeTrend: stats ? formatTrend(stats.totalPropertiesTrend) : "+0%",
    revenueMtd: stats
      ? `${formatCompactKES(stats.incomeKes)} / mo`
      : "KES 0 / mo",
    revenueTrend: stats ? formatTrend(stats.incomeTrend) : "+0%",
    closedDeals: stats ? stats.closedDealsCount.toString() : "0",
    closedTrend: stats ? formatTrend(stats.closedDealsTrend) : "+0%",
    activePipeline: stats ? stats.activePipelineCount.toString() : "0",
    radialVal: stats ? stats.occupancyRate + "%" : "0%",
    radialPct: stats ? stats.occupancyRate : 0,
    radialSub: stats
      ? `${stats.occupiedProperties} of ${stats.totalProperties} occupied`
      : "current occupancy rate",
    rentPool: stats ? stats.rentPool : 0,
    expiringLeases30d: stats ? stats.expiringLeases30d : 0,
    income: stats ? stats.incomeKes : 0,
    expenses: stats ? stats.expensesKes : 0,
    profit: stats ? stats.profitKes : 0,
    incomeGrowth: stats ? stats.incomeTrend : 0,
    expenseGrowth: stats ? stats.expensesTrend : 0,
    profitGrowth: stats ? stats.profitTrend : 0,
    newLeads: stats ? stats.newLeadsCount.toString() : "0",
    newLeadsGrowth: stats ? formatTrend(stats.newLeadsTrend) : "+0%",
    siteInquiries: stats ? stats.propertyInquiriesCount.toString() : "0",
    inquiryRate: stats ? `${stats.conversionRate}%` : "0%",
  };

  const profitMargin =
    stats && stats.incomeKes > 0
      ? Math.round((stats.profitKes / stats.incomeKes) * 100)
      : 0;

  const hasListings = listings.length > 0;
  const featured = hasListings
    ? {
      name: listings[0].name,
      location: listings[0].location,
      price: listings[0].price,
      roi: listings[0].roi,
      imageUrl: listings[0].imageUrl,
      status: listings[0].status,
    }
    : null;

  const chartData = stats?.chartSeries ?? [];

  // ─── Listing Board Logic ─────────────────────────────

  const filteredListings = useMemo(() => {
    let result = listings.filter(
      (l) =>
        l.name.toLowerCase().includes(listingSearch.toLowerCase()) ||
        l.location.toLowerCase().includes(listingSearch.toLowerCase()) ||
        l.type.toLowerCase().includes(listingSearch.toLowerCase()),
    );
    if (sortField) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (
          aVal === undefined ||
          bVal === undefined ||
          aVal === null ||
          bVal === null
        )
          return 0;
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [listings, listingSearch, sortField, sortDir]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredListings.length / ROWS_PER_PAGE),
  );
  const paginatedListings = filteredListings.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE,
  );

  const handleSort = (field: keyof PropertyListing) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  // PropertyFormModal now owns its own POST/PATCH call for both create and
  // edit (previously this component made a *second*, redundant PATCH on
  // every edit - the modal itself always POSTed regardless of mode, so
  // editing a property silently created a duplicate via POST while this
  // handler separately PATCHed the original). This is just the post-success
  // refresh now.
  const handlePropertySaved = useCallback(() => {
    loadDashboardData();
    setCurrentPage(1);
  }, [loadDashboardData]);

  const handleDeleteProperty = useCallback(async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/properties?id=${deleteConfirmId}&entityId=${context}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to delete property");
      }
      const name = listings.find((l) => l.id === deleteConfirmId)?.name;
      loadDashboardData();
      pushToast({
        tone: "success",
        title: "Property Removed",
        body: `${name} has been removed from the portfolio.`,
      });
    } catch (err) {
      console.error(err);
      pushToast({
        tone: "warning",
        title: "Failed to delete",
        body: err instanceof Error ? err.message : "Could not delete property.",
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
      setRowMenuOpen(null);
    }
  }, [deleteConfirmId, listings, loadDashboardData, pushToast, context]);

  const handleRefresh = async () => {
    loadDashboardData();
    pushToast({
      tone: "info",
      title: "Dashboard Refreshed",
      body: "All metrics updated to latest data.",
    });
  };

  // Sort indicator
  const SortIndicator = ({ field }: { field: keyof PropertyListing }) =>
    sortField === field ? (
      <span className="ml-1 text-sm">{sortDir === "asc" ? "▲" : "▼"}</span>
    ) : null;

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-3 transition-opacity duration-300">
      {/* ── Hero Command Title ──────────────────────────────── */}
      <section
        className="relative z-10 flex flex-col justify-center gap-1 border-b border-slate-200/60 pb-3 animate-fade-in-up"
        aria-label="Dashboard header"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className="text-slate-400 hidden sm:inline mono-data">
              Updated{" "}
              {mounted
                ? lastRefreshed.toLocaleTimeString("en-KE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
                : "--:--"}
            </span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-800 transition-colors bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm hover:shadow",
                isRefreshing && "opacity-60",
              )}
              aria-label="Refresh dashboard"
            >
              <IconRefresh
                size={13}
                stroke={2}
                className={cn(isRefreshing && "animate-spin")}
              />
              Refresh
            </button>
            <div className="relative group">
              <button className="flex items-center gap-1.5 text-sm font-medium text-white bg-tertiary-gradient px-3 py-1.5 rounded-lg shadow-sm hover:opacity-95 transition-all">
                <IconPlus size={13} stroke={2.5} />
                Quick Action
              </button>
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 py-1">
                <Link
                  href="/admin/properties"
                  className="flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-sm"
                >
                  <IconBuildingSkyscraper size={14} /> Add Property
                </Link>
                <Link
                  href="/admin/contacts"
                  className="flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-sm"
                >
                  <IconPlus size={14} /> Add Contact
                </Link>
                <Link
                  href="/fin"
                  className="flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-sm"
                >
                  <IconReceipt size={14} /> Record Payment
                </Link>
                <Link
                  href="/admin/pipeline"
                  className="flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-sm"
                >
                  <IconCalendarEvent size={14} /> Schedule Viewing
                </Link>
              </div>
            </div>
          </div>
        </div>
        <h1 className="title-serif text-slate-900 mt-2">
          {isComm
            ? "Commercial Portfolio Command"
            : isRes
              ? "Residential Portfolio Command"
              : "Real Estate Management Command"}
        </h1>
        <p className="text-base text-slate-400 max-w-3xl leading-relaxed mt-1">
          Monitor transactional metrics, manage dynamic property listings,
          evaluate sales analytics pipelines, and coordinate operational tasks
          from this unified command center.
        </p>
      </section>

      {/* ── Grid Row 1: Key Performance Metrics ── */}
      <section
        className="gsap-stagger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 my-8"
        aria-label="Key performance indicators"
      >
        {/* Col 1: Active Listings + Revenue (Stacked) */}
        <div className="flex flex-col gap-3">
          <Link
            href="/admin/properties"
            className="animate-fade-in-up stagger-1 block h-[155px]"
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-white to-[#e1f3f6]/40 border border-slate-200/80 shadow-sm rounded-2xl p-5 flex flex-col justify-between h-full hover:shadow-md hover:border-slate-300 hover:from-white hover:to-[#e1f3f6]/60 transition-all duration-300 group">
              <IconBuildingSkyscraper
                size={140}
                stroke={1}
                className="absolute -right-6 -bottom-6 text-[#2e626a] opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-500 pointer-events-none"
              />
              <div className="flex items-start justify-between relative z-10">
                <div className="flex flex-col gap-1 max-w-[calc(100%-48px)]">
                  <span className="text-desc-secondary">Active Listings</span>
                  <span className="font-mono font-medium text-slate-900 mt-1 text-4xl">
                    {metrics.activeListings}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-auto relative z-10">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "mono-data text-xs flex font-medium items-center px-1.5 py-0.5 rounded-md",
                      metrics.activeTrend.includes("+")
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700",
                    )}
                  >
                    {metrics.activeTrend.includes("+") ? (
                      <IconTrendingUp size={12} className="mr-1" />
                    ) : (
                      <IconTrendingDown size={12} className="mr-1" />
                    )}
                    {metrics.activeTrend.replace("+", "")}
                  </span>
                  <span className="text-meta-muted">vs last month</span>
                </div>
                <IconArrowUpRight
                  size={14}
                  className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
            </div>
          </Link>

          <Link
            href="/fin"
            className="animate-fade-in-up stagger-2 block h-[155px]"
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-white to-[#e6f4ea]/40 border border-slate-200/80 shadow-sm rounded-2xl p-5 flex flex-col justify-between h-full hover:shadow-md hover:border-slate-300 hover:from-white hover:to-[#e6f4ea]/60 transition-all duration-300 group">
              <IconCoin
                size={140}
                stroke={1}
                className="absolute -right-6 -bottom-6 text-[#1b431e] opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-500 pointer-events-none"
              />
              <div className="flex items-start justify-between relative z-10">
                <div className="flex flex-col gap-1 max-w-[calc(100%-48px)]">
                  <span className="text-desc-secondary">Total Revenue</span>
                  <span className="font-mono font-medium text-slate-900 mt-1 text-3xl flex items-baseline gap-1 truncate">
                    {formatCompactKES(metrics.income)}
                    <span className="text-meta-muted">/mo</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-auto relative z-10">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "mono-data text-xs flex font-medium items-center px-1.5 py-0.5 rounded-md",
                      metrics.revenueTrend.includes("+")
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700",
                    )}
                  >
                    {metrics.revenueTrend.includes("+") ? (
                      <IconTrendingUp size={12} className="mr-1" />
                    ) : (
                      <IconTrendingDown size={12} className="mr-1" />
                    )}
                    {metrics.revenueTrend.replace("+", "")}
                  </span>
                  <span className="text-meta-muted">vs last month</span>
                </div>
                <IconArrowUpRight
                  size={14}
                  className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
            </div>
          </Link>
        </div>

        {/* Col 2-3: Featured Property */}
        <Card className="h-[322px] bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all overflow-hidden relative group flex flex-col justify-between animate-fade-in-up stagger-3 rounded-2xl lg:col-span-2">
          {featured ? (
            <>
              <div className="absolute inset-0 z-0">
                {featured.imageUrl ? (
                  <Image
                    src={featured.imageUrl}
                    alt={featured.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 600px"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="size-full bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center">
                    <IconBuildingSkyscraper
                      size={48}
                      className="text-slate-700"
                      stroke={1}
                    />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-slate-950/20" />
              </div>
              <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between z-10">
                <span className="backdrop-blur-md bg-white/10 text-white border border-white/20 px-2.5 py-1 rounded-md label-caps">
                  Featured
                </span>
                <Link
                  href="/admin/properties"
                  className="backdrop-blur-md bg-white/10 text-white hover:bg-white/20 border border-white/20 body-sm px-2.5 py-1 rounded-md flex items-center gap-1 transition-all"
                >
                  View All <IconArrowUpRight size={13} />
                </Link>
              </div>
              <div className="absolute bottom-0 inset-x-0 p-5 flex flex-col justify-end text-white z-10">
                <div>
                  <p className="text-[#f3df27] mono-stat">{featured.price}</p>
                  <h3 className="text-lg text-white mt-1 leading-snug">
                    {featured.name}
                  </h3>
                  <p className="text-sm text-slate-300 mt-1">
                    {featured.location}
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/15">
                  <span
                    className={cn(
                      "label-caps px-2 py-0.5 rounded-full border",
                      STATUS_DARK_TONES[featured.status],
                    )}
                  >
                    {featured.status}
                  </span>
                  <span className="body-sm text-slate-300">{featured.roi}</span>
                  <button
                    onClick={() =>
                      setDrawerProperty({
                        id: "featured",
                        ...featured,
                        type: "Premium Estate",
                      })
                    }
                    className="ml-auto inline-flex h-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 body-sm transition"
                  >
                    More Details
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="size-full flex flex-col items-center justify-center gap-4 text-center px-6 bg-slate-50/50">
              <div className="size-14 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center">
                <IconBuildingSkyscraper
                  size={24}
                  className="text-slate-400"
                  stroke={1.5}
                />
              </div>
              <div>
                <p className="text-title-primary">No properties registered</p>
                <p className="text-body-regular mt-1 max-w-[200px] mx-auto">
                  Add your first property to feature it here.
                </p>
              </div>
              <button
                onClick={() => {
                  setPropertyModalMode("create");
                  setEditingProperty(null);
                  setPropertyModalOpen(true);
                }}
                className="mt-2 inline-flex items-center gap-2 text-white font-medium bg-slate-900 px-4 py-1.5 text-sm rounded-xl shadow-sm hover:bg-slate-800 transition-colors"
              >
                <IconPlus size={14} stroke={2.5} /> Add Property
              </button>
            </div>
          )}
        </Card>

        {/* Col 4: Profit / Loss & Revenue (Stacked) */}
        <div className="flex flex-col gap-3">
          <Link
            href="/fin"
            className="animate-fade-in-up stagger-4 block h-[155px]"
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-white to-[#f0f9ff]/40 border border-slate-200/80 shadow-sm rounded-2xl p-5 flex flex-col justify-between h-full hover:shadow-md hover:border-slate-300 hover:from-white hover:to-[#f0f9ff]/60 transition-all duration-300 group">
              <IconChartLine
                size={140}
                stroke={1}
                className="absolute -right-6 -bottom-6 text-[#0369a1] opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-500 pointer-events-none"
              />
              <div className="flex items-start justify-between relative z-10">
                <div className="flex flex-col gap-1 max-w-[calc(100%-48px)]">
                  <span className="text-desc-secondary">Total PnL</span>
                  <span className="font-mono font-medium text-slate-900 mt-1 text-3xl truncate">
                    {formatCompactKES(metrics.profit)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-auto relative z-10">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "mono-data text-xs flex font-medium items-center px-1.5 py-0.5 rounded-md",
                      metrics.profitGrowth >= 0
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700",
                    )}
                  >
                    {metrics.profitGrowth >= 0 ? (
                      <IconTrendingUp size={12} className="mr-1" />
                    ) : (
                      <IconTrendingDown size={12} className="mr-1" />
                    )}
                    {Math.abs(metrics.profitGrowth)}%
                  </span>
                  <span className="text-meta-muted">vs last month</span>
                </div>
                <IconArrowUpRight
                  size={14}
                  className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
            </div>
          </Link>

          <Link
            href="/fin"
            className="animate-fade-in-up stagger-5 block h-[155px]"
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-white to-[#fdf2f8]/40 border border-slate-200/80 shadow-sm rounded-2xl p-5 flex flex-col justify-between h-full hover:shadow-md hover:border-slate-300 hover:from-white hover:to-[#fdf2f8]/60 transition-all duration-300 group">
              <IconWallet
                size={140}
                stroke={1}
                className="absolute -right-6 -bottom-6 text-[#be123c] opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-500 pointer-events-none"
              />
              <div className="flex items-start justify-between relative z-10">
                <div className="flex flex-col gap-1 max-w-[calc(100%-48px)]">
                  <span className="text-desc-secondary">Monthly Rent Pool</span>
                  <span className="font-mono font-medium text-slate-900 mt-1 text-3xl truncate">
                    {formatCompactKES(metrics.rentPool)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-auto relative z-10">
                <div className="flex items-center gap-2">
                  <span className="text-meta-muted">Across occupied portfolio</span>
                </div>
                <IconArrowUpRight
                  size={14}
                  className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
            </div>
          </Link>
        </div>

        {/* Col 5: Closed Deals + New Deals */}
        {/* <div className="flex flex-col gap-3">
          <Link href="/admin/pipeline?stage=closed_won" className="animate-fade-in-up stagger-6 block h-[155px]">
            <div className="relative overflow-hidden bg-gradient-to-br from-white to-[#fcf0e4]/40 border border-slate-200/80 shadow-sm rounded-2xl p-5 flex flex-col justify-between h-full hover:shadow-md hover:border-slate-300 hover:from-white hover:to-[#fcf0e4]/60 transition-all duration-300 group">
              <IconFileCheck size={140} stroke={1} className="absolute -right-6 -bottom-6 text-[#824429] opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-500 pointer-events-none" />
              <div className="flex items-start justify-between relative z-10">
                <div className="flex flex-col gap-1 max-w-[calc(100%-48px)]">
                  <span className="text-desc-secondary">Closed Deals</span>
                  <span className="font-mono font-medium text-slate-900 mt-1 text-3xl">{metrics.closedDeals}</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-auto relative z-10">
                <div className="flex items-center gap-2">
                  <span className={cn("mono-data text-xs flex items-center px-1.5 py-0.5 rounded-md", metrics.closedTrend.includes("+") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                    {metrics.closedTrend.includes("+") ? <IconTrendingUp size={12} className="mr-1" /> : <IconTrendingDown size={12} className="mr-1" />}
                    {metrics.closedTrend.replace("+", "")}
                  </span>
                  <span className="text-meta-muted">vs last month</span>
                </div>
                <IconArrowUpRight size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </Link>

          <Link href="/admin/pipeline" className="animate-fade-in-up stagger-7 block h-[155px]">
            <div className="relative overflow-hidden bg-gradient-to-br from-white to-[#eef2f6]/40 border border-slate-200/80 shadow-sm rounded-2xl p-5 flex flex-col justify-between h-full hover:shadow-md hover:border-slate-300 hover:from-white hover:to-[#eef2f6]/60 transition-all duration-300 group">
              <IconHomePlus size={140} stroke={1} className="absolute -right-6 -bottom-6 text-[#415671] opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-500 pointer-events-none" />
              <div className="flex items-start justify-between relative z-10">
                <div className="flex flex-col gap-1 max-w-[calc(100%-48px)]">
                  <span className="text-desc-secondary">Active Pipeline</span>
                  <span className="font-mono font-medium text-slate-900 mt-1 text-3xl flex items-baseline gap-1">
                    {metrics.activePipeline}
                    <span className="text-meta-muted">deals</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-auto relative z-10">
                <div className="flex items-center gap-2">
                  <span className="text-meta-muted">Currently open</span>
                </div>
                <IconArrowUpRight size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </Link>
        </div> */}

        {/* Col 6: Radial */}
        <Card className="p-0 flex flex-col items-center justify-center h-[322px] bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all animate-fade-in-up stagger-8 rounded-2xl overflow-hidden">
          {mounted ? (
            <RadialProgress
              percentage={metrics.radialPct}
              subtitle={metrics.radialSub}
            />
          ) : (
            <div className="flex-1 flex flex-col gap-4 items-center justify-center w-full">
              <div className="skeleton-shimmer h-32 w-32 rounded-full" />
              <div className="skeleton-shimmer h-4 w-16 rounded-full" />
            </div>
          )}
        </Card>
      </section>

      {/* Dynamic Approvals Queue for CEO and GM */}
      {(currentUserRole === "ceo" || currentUserRole === "general_manager") &&
        stats?.awaitingMyDecision?.count &&
        stats.awaitingMyDecision.count > 0 ? (
        <section
          className="w-full mt-2 animate-fade-in-up"
          aria-label="Approvals Queue"
        >
          <ApprovalQueue onActionComplete={loadDashboardData} />
        </section>
      ) : null}

      {/* ── Internal Structure & Scheduler ─────────── */}
      <section className="w-full" aria-label="Internal operations">
        <InternalOperationsBoard
          entityId={context}
          departmentStats={stats?.departmentStats}
        />
      </section>

      {/* ── Revenue Analytics ─ */}
      <div className="pt-6 border-t border-slate-200/60 my-4">
        <h2 className="title-serif text-slate-900">
          Operational Analytics & Insights
        </h2>
        <p className="text-base text-slate-400 font-medium tracking-wide mt-1">
          Deep-dive into revenue trends and core performance metrics.
        </p>
      </div>

      <section
        className="gsap-stagger grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch"
        aria-label="Revenue analytics"
      >
        <div className="xl:col-span-8 flex flex-col justify-between bg-transparent sm:bg-white rounded-none sm:rounded-[32px] border-0 sm:border border-slate-100 shadow-none sm:shadow-[0_8px_30px_rgb(0,0,0,0.04)] my-4 sm:my-0 p-0 sm:p-8 transition-all relative overflow-hidden group">
          {/* Subtle background glow */}
          <div className="hidden sm:block absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-indigo-50/50 to-transparent rounded-full blur-3xl -z-10 pointer-events-none opacity-60" />

          <div className="relative z-10">
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between mb-8 flex-wrap gap-4">
              <h2 className="text-title-primary">Revenue Trajectory</h2>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Period selector */}
                <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                  {(["week", "month", "quarter"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setChartPeriod(p)}
                      className={cn(
                        "body-sm px-3.5 py-1.5 rounded-lg transition-all capitalize",
                        chartPeriod === p
                          ? "bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] text-slate-900"
                          : "text-slate-400 hover:text-slate-700",
                      )}
                    >
                      This {p}
                    </button>
                  ))}
                </div>
                {/* Data filter */}
                <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                  {(["all", "Revenue", "Transactions", "Leads"] as const).map(
                    (f) => (
                      <button
                        key={f}
                        onClick={() => setChartFilter(f)}
                        className={cn(
                          "body-sm px-4 py-1.5 rounded-lg transition-all",
                          chartFilter === f
                            ? "bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] text-slate-900"
                            : "text-slate-400 hover:text-slate-700",
                        )}
                      >
                        {f === "all" ? "All" : f}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 gsap-stagger">
              {/* Income */}
              <div className="flex items-start gap-4 p-5 rounded-[20px] bg-slate-50/80 hover:bg-white hover:shadow-[0_8px_20px_rgb(0,0,0,0.03)] border border-transparent hover:border-slate-100 transition-all duration-300 group/stat">
                <div className="size-12 rounded-[14px] bg-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover/stat:scale-110 group-hover/stat:bg-emerald-500 group-hover/stat:text-white transition-all duration-500 shrink-0">
                  <IconCoin size={22} stroke={2} />
                </div>
                <div>
                  <p className="label-caps mb-1.5">Income</p>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="mono-stat text-slate-900">
                      {formatCompactKES(metrics.income)}
                    </span>
                    <span
                      className={cn(
                        "mono-data flex items-center",
                        metrics.incomeGrowth >= 0
                          ? "text-emerald-500"
                          : "text-rose-500",
                      )}
                    >
                      {metrics.incomeGrowth >= 0 ? (
                        <IconTrendingUp size={14} className="mr-0.5" />
                      ) : (
                        <IconTrendingDown size={14} className="mr-0.5" />
                      )}
                      {Math.abs(metrics.incomeGrowth)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Expenses */}
              <div className="flex items-start gap-4 p-5 rounded-[20px] bg-slate-50/80 hover:bg-white hover:shadow-[0_8px_20px_rgb(0,0,0,0.03)] border border-transparent hover:border-slate-100 transition-all duration-300 group/stat">
                <div className="size-12 rounded-[14px] bg-amber-500/10 flex items-center justify-center text-amber-600 group-hover/stat:scale-110 group-hover/stat:bg-amber-500 group-hover/stat:text-white transition-all duration-500 shrink-0">
                  <IconWallet size={22} stroke={2} />
                </div>
                <div>
                  <p className="label-caps mb-1.5">Expenses</p>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="mono-stat text-slate-900">
                      {formatCompactKES(metrics.expenses)}
                    </span>
                    <span
                      className={cn(
                        "mono-data flex items-center",
                        metrics.expenseGrowth <= 0
                          ? "text-emerald-500"
                          : "text-rose-500",
                      )}
                    >
                      {metrics.expenseGrowth > 0 ? (
                        <IconTrendingUp size={14} className="mr-0.5" />
                      ) : (
                        <IconTrendingDown size={14} className="mr-0.5" />
                      )}
                      {Math.abs(metrics.expenseGrowth)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Profit */}
              <div className="flex items-start gap-4 p-5 rounded-[20px] bg-slate-50/80 hover:bg-white hover:shadow-[0_8px_20px_rgb(0,0,0,0.03)] border border-transparent hover:border-slate-100 transition-all duration-300 group/stat">
                <div className="size-12 rounded-[14px] bg-indigo-500/10 flex items-center justify-center text-indigo-600 group-hover/stat:scale-110 group-hover/stat:bg-indigo-500 group-hover/stat:text-white transition-all duration-500 shrink-0">
                  <IconChartLine size={22} stroke={2} />
                </div>
                <div>
                  <p className="label-caps mb-1.5">Profit</p>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="mono-stat text-slate-900">
                      {formatCompactKES(metrics.profit)}
                    </span>
                    <span
                      className={cn(
                        "mono-data flex items-center",
                        metrics.profitGrowth >= 0
                          ? "text-emerald-500"
                          : "text-rose-500",
                      )}
                    >
                      {metrics.profitGrowth >= 0 ? (
                        <IconTrendingUp size={14} className="mr-0.5" />
                      ) : (
                        <IconTrendingDown size={14} className="mr-0.5" />
                      )}
                      {Math.abs(metrics.profitGrowth)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[260px] flex items-end relative z-10 bg-slate-50/50 rounded-2xl p-4 border border-slate-100/50">
            {mounted ? (
              <SalesChart data={chartData} activeFilter={chartFilter} />
            ) : (
              <div className="h-full w-full skeleton-shimmer rounded-2xl" />
            )}
          </div>
        </div>

        {/* Stats Column */}
        <div className="xl:col-span-4 flex flex-col gap-4 gsap-stagger">
          {/* Sales Statistic - KES */}
          <Link href="/fin" className="block flex-1 group/card">
            <div className="p-6 bg-white rounded-[24px] sm:rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-500 h-full relative overflow-hidden min-h-[140px]">
              <div className="absolute top-0 right-0 p-6 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 translate-x-2 group-hover/card:translate-x-0 group-hover/card:-translate-y-1">
                <IconArrowUpRight size={20} className="text-slate-400" />
              </div>
              <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="text-title-primary">
                  Property Management Performance
                </h3>
              </div>
              <div className="flex items-end justify-between relative z-10 gap-2">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-[14px] bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 group-hover/card:scale-110 group-hover/card:bg-indigo-600 group-hover/card:text-white transition-all duration-500">
                    <IconCoin size={22} stroke={2} />
                  </div>
                  <div>
                    <p className="label-caps mb-1">Total Profit</p>
                    <p className="mono-stat text-slate-900">
                      {formatCompactKES(metrics.profit)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2 mb-2.5">
                    <p className="label-caps">Margin</p>
                    <span
                      className={cn(
                        "mono-data",
                        profitMargin >= 0
                          ? "text-emerald-500"
                          : "text-rose-500",
                      )}
                    >
                      {profitMargin >= 0 ? "+" : ""}
                      {profitMargin}%
                    </span>
                  </div>
                  <div className="w-20 sm:w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        profitMargin >= 0
                          ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                          : "bg-gradient-to-r from-rose-400 to-rose-500",
                      )}
                      style={{
                        width: `${Math.min(100, Math.abs(profitMargin))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Site Inquiries - CRM Relevant */}
          <div className="p-6 bg-white rounded-[24px] sm:rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-500 flex-1 min-h-[140px] group/card relative overflow-hidden">
            <div className="flex items-center justify-between mb-4 relative z-10">
              <h3 className="text-title-primary">Site Inquiries</h3>
              <div className="size-8 rounded-[10px] bg-sky-50 text-sky-600 flex items-center justify-center group-hover/card:scale-110 group-hover/card:bg-sky-500 group-hover/card:text-white transition-all duration-500">
                <IconChartLine size={16} stroke={2} />
              </div>
            </div>
            <div className="flex items-end justify-between relative z-10">
              <div>
                <p className="label-caps mb-1">Inquiries This Week</p>
                <div className="flex items-center gap-2">
                  <span className="mono-stat text-slate-900">
                    {metrics.siteInquiries}
                  </span>
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <p className="label-caps mb-1.5">Conversion</p>
                <span className="mono-data text-sky-600 bg-sky-50 px-2.5 py-1 rounded-lg">
                  {metrics.inquiryRate}
                </span>
              </div>
            </div>
          </div>

          {/* New Leads - CRM Relevant */}
          <Link href="/admin/pipeline" className="block flex-1 group/card">
            <div className="p-6 bg-white rounded-[24px] sm:rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-500 h-full relative overflow-hidden min-h-[140px]">
              <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="text-title-primary">New Leads</h3>
                <span className="label-caps bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-md">
                  MTD
                </span>
              </div>
              <div className="flex items-end justify-between relative z-10">
                <div>
                  <p className="label-caps mb-1">Added This Month</p>
                  <div className="flex items-center gap-2.5">
                    <span className="mono-stat text-slate-900">
                      {metrics.newLeads}
                    </span>
                    <span
                      className={cn(
                        "mono-data flex items-center",
                        stats && stats.newLeadsTrend < 0
                          ? "text-rose-500"
                          : "text-emerald-500",
                      )}
                    >
                      {stats && stats.newLeadsTrend < 0 ? (
                        <IconTrendingDown size={14} className="mr-0.5" />
                      ) : (
                        <IconTrendingUp size={14} className="mr-0.5" />
                      )}{" "}
                      {metrics.newLeadsGrowth}
                    </span>
                  </div>
                </div>
                <div className="flex items-end gap-1.5 h-10 group-hover/card:gap-2 transition-all duration-500">
                  <div className="w-3.5 h-[30%] bg-slate-100 rounded-sm group-hover/card:bg-slate-200 transition-colors" />
                  <div className="w-3.5 h-[50%] bg-slate-100 rounded-sm group-hover/card:bg-slate-200 transition-colors" />
                  <div className="w-3.5 h-[70%] bg-indigo-500/20 rounded-sm group-hover/card:bg-indigo-500/40 transition-colors" />
                  <div className="w-3.5 h-[100%] bg-indigo-600 rounded-sm shadow-sm" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ── Listing Board + Growth Widget ─ */}
      <section
        className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch mt-1"
        aria-label="Property listing board"
      >
        <div className="my-4 sm:my-0 p-0 sm:p-6 xl:col-span-8 flex flex-col justify-between bg-transparent sm:bg-white rounded-none sm:rounded-[20px] border-0 sm:border sm:border-slate-100 shadow-none sm:shadow-sm sm:hover:shadow-md transition-all overflow-hidden min-h-[420px]">
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2 border-b border-slate-100/60 pb-4">
              <div>
                <h2 className="text-title-primary">Listing Board</h2>
                {activeTab === "listings" && (
                  <p className="text-meta-muted mt-0.5">
                    {formatCompactKES(metrics.rentPool)} total rent pool under
                    management
                    {metrics.expiringLeases30d > 0 && (
                      <>
                        {" "}·{" "}
                        <Link href="/admin/leases" className="text-amber-600 hover:underline">
                          {metrics.expiringLeases30d} lease{metrics.expiringLeases30d === 1 ? "" : "s"} expiring within 30 days
                        </Link>
                      </>
                    )}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {/* Tab switcher */}
                <div className="flex items-center gap-1 bg-slate-50/80 p-1 rounded-lg">
                  {(["listings", "activity", "transactions"] as const).map(
                    (tab) => (
                      <button
                        key={tab}
                        onClick={() => {
                          setActiveTab(tab);
                          setCurrentPage(1);
                        }}
                        className={cn(
                          "body-sm px-3.5 py-1.5 rounded-md transition-all tracking-wide capitalize",
                          activeTab === tab
                            ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-slate-800 font-medium"
                            : "text-slate-400 hover:text-slate-700",
                        )}
                      >
                        {tab === "activity"
                          ? "Activity Logs"
                          : tab === "transactions"
                            ? "Transactions"
                            : "Listings"}
                      </button>
                    ),
                  )}
                </div>
                {activeTab === "listings" && (
                  <button
                    onClick={() => {
                      setPropertyModalMode("create");
                      setEditingProperty(null);
                      setPropertyModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 text-sm font-medium text-white bg-tertiary-gradient px-4 py-1.5 rounded-lg shadow-sm hover:shadow hover:opacity-95 transition-all"
                  >
                    <IconPlus size={14} stroke={2.5} />
                    Add Property
                  </button>
                )}
              </div>
            </div>

            {/* Search (listings only) */}
            {activeTab === "listings" && (
              <div className="relative mb-3">
                <IconSearch
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search properties…"
                  value={listingSearch}
                  onChange={(e) => {
                    setListingSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setListingSearch("");
                  }}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-100 bg-slate-50/50 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/30 transition-colors text-base"
                />
              </div>
            )}
          </div>

          {/* Listings Tab */}
          {activeTab === "listings" && (
            <div className="flex-1 flex flex-col">
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center py-20">
                  <LoadingSpinner size="lg" />
                </div>
              ) : (
                <div className="flex-1 flex flex-col animate-fade-in">
                  {/* Desktop view */}
                  <div className="hidden sm:block flex-1 overflow-x-auto [scrollbar-width:thin] mt-1">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="border-b border-slate-100/60 text-slate-400 label-caps">
                          {(
                            [
                              ["name", "Property Name"],
                              ["location", "Location"],
                              ["type", "Type"],
                              ["status", "Status"],
                              ["roi", "ROI"],
                              ["price", "Price"],
                            ] as [keyof PropertyListing, string][]
                          ).map(([field, label]) => (
                            <th
                              key={field}
                              className={cn(
                                "pb-3 px-2 font-medium cursor-pointer hover:text-slate-600 transition-colors select-none",
                                field === "name" && "pr-2 pl-0",
                                field === "price" && "text-right",
                              )}
                              onClick={() => handleSort(field)}
                            >
                              {label}
                              <SortIndicator field={field} />
                            </th>
                          ))}
                          <th className="pb-3 pl-2 font-medium w-10" />
                        </tr>
                      </thead>
                      <tbody className="gsap-stagger divide-y divide-slate-50/80">
                        {paginatedListings.length > 0 ? (
                          paginatedListings.map((listing, idx) => (
                            <tr
                              key={listing.id}
                              className={cn(
                                "text-base text-slate-700 hover:bg-slate-50/40 transition-colors group animate-fade-in-up",
                                rowMenuOpen === listing.id
                                  ? "relative z-50"
                                  : "relative z-0",
                              )}
                              style={{ animationDelay: `${idx * 30}ms` }}
                            >
                              <td className="py-3 pr-2 flex items-center gap-3 font-medium text-slate-800">
                                <div className="size-10 relative rounded-[10px] overflow-hidden shrink-0 shadow-sm border border-slate-100/50 bg-slate-100 flex items-center justify-center">
                                  {listing.imageUrl ? (
                                    <Image
                                      src={listing.imageUrl}
                                      alt={listing.name}
                                      fill
                                      sizes="40px"
                                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                  ) : (
                                    <IconBuildingSkyscraper
                                      size={16}
                                      className="text-slate-400"
                                      stroke={1.5}
                                    />
                                  )}
                                </div>
                                <button
                                  onClick={() => setDrawerProperty(listing)}
                                  className="truncate max-w-[150px] tracking-wide text-base hover:text-[#151936] transition-colors text-left"
                                >
                                  {listing.name}
                                </button>
                              </td>
                              <td className="py-3 px-2 text-slate-400 font-medium text-base">
                                {listing.location}
                              </td>
                              <td className="py-3 px-2 text-slate-400 font-medium text-base">
                                {listing.type}
                              </td>
                              <td className="py-3 px-2">
                                <span
                                  className={cn(
                                    "text-sm  px-2.5 py-1 rounded-md font-medium tracking-wide whitespace-nowrap",
                                    TABLE_STATUS_STYLES[listing.status],
                                  )}
                                >
                                  {listing.status}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-slate-600 mono-data">
                                {listing.roi}
                              </td>
                              <td className="py-3 px-2 text-right text-slate-800 mono-amount">
                                {listing.price}
                              </td>
                              <td className="py-3 pl-2 relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRowMenuOpen(
                                      rowMenuOpen === listing.id
                                        ? null
                                        : listing.id,
                                    );
                                  }}
                                  className="size-7 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                                  aria-label="Row actions"
                                >
                                  <IconDotsVertical size={15} />
                                </button>
                                {rowMenuOpen === listing.id && (
                                  <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] z-20 py-1 animate-scale-in">
                                    <button
                                      onClick={() => {
                                        setDrawerProperty(listing);
                                        setRowMenuOpen(null);
                                      }}
                                      className="flex items-center gap-2 w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-left text-base"
                                    >
                                      <IconEye size={14} /> View Details
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingProperty(listing);
                                        setPropertyModalMode("edit");
                                        setPropertyModalOpen(true);
                                        setRowMenuOpen(null);
                                      }}
                                      className="flex items-center gap-2 w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-left text-base"
                                    >
                                      <IconEdit size={14} /> Edit Property
                                    </button>
                                    <button
                                      onClick={() => {
                                        setRowMenuOpen(null);
                                      }}
                                      className="flex items-center gap-2 w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-left text-base"
                                    >
                                      <IconStatusChange size={14} /> Change
                                      Status
                                    </button>
                                    <div className="border-t border-slate-100 my-1" />
                                    <button
                                      onClick={() => {
                                        setDeleteConfirmId(listing.id);
                                        setRowMenuOpen(null);
                                      }}
                                      className="flex items-center gap-2 w-full px-3.5 py-2 text-red-600 hover:bg-red-50 font-medium transition-colors text-left text-base"
                                    >
                                      <IconTrash size={14} /> Delete
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="py-12 text-center">
                              <div className="flex flex-col items-center gap-2">
                                <IconBuildingSkyscraper
                                  size={28}
                                  className="text-slate-300"
                                />
                                <p className="text-base text-slate-400 font-medium">
                                  No properties match your search.
                                </p>
                                <button
                                  onClick={() => setListingSearch("")}
                                  className="text-base text-[#151936] font-medium hover:underline"
                                >
                                  Clear search
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile view */}
                  <div className="block sm:hidden flex-1 space-y-3 mt-1">
                    {paginatedListings.length > 0 ? (
                      paginatedListings.map((listing, idx) => (
                        <div
                          key={listing.id}
                          className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm flex flex-col gap-3 group animate-fade-in-up"
                          style={{ animationDelay: `${idx * 40}ms` }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="size-11 relative rounded-lg overflow-hidden shrink-0 border border-slate-100 bg-slate-100 flex items-center justify-center">
                              {listing.imageUrl ? (
                                <Image
                                  src={listing.imageUrl}
                                  alt={listing.name}
                                  fill
                                  sizes="44px"
                                  className="object-cover"
                                />
                              ) : (
                                <IconBuildingSkyscraper
                                  size={16}
                                  className="text-slate-400"
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-base text-slate-800 font-medium truncate">
                                {listing.name}
                              </h4>
                              <p className="text-xs text-slate-455 mt-0.5">
                                {listing.location}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "text-xs px-2.5 py-0.5 rounded-full font-medium tracking-wide whitespace-nowrap",
                                TABLE_STATUS_STYLES[listing.status],
                              )}
                            >
                              {listing.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                            <div>
                              <span className="text-xs text-slate-400 uppercase tracking-wider block">
                                ROI / Price
                              </span>
                              <div className="flex items-baseline gap-1.5 mt-0.5">
                                <span className="mono-data text-xs text-slate-600 font-mono">
                                  {listing.roi}
                                </span>
                                <span className="text-slate-300">·</span>
                                <span className="mono-amount text-xs text-slate-850 font-mono">
                                  {listing.price}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setDrawerProperty(listing)}
                                className="text-xs text-[#151936] hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors font-medium"
                              >
                                Details
                              </button>
                              <button
                                onClick={() => {
                                  setEditingProperty(listing);
                                  setPropertyModalMode("edit");
                                  setPropertyModalOpen(true);
                                }}
                                className="text-xs text-slate-400 hover:text-slate-700 border border-slate-200 p-1.5 rounded-lg transition-colors"
                                aria-label="Edit"
                              >
                                <IconEdit size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteConfirmId(listing.id);
                                }}
                                className="text-xs text-red-500 hover:text-red-700 border border-red-100 bg-red-50/50 p-1.5 rounded-lg transition-colors"
                                aria-label="Delete"
                              >
                                <IconTrash size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <IconBuildingSkyscraper
                          size={28}
                          className="text-slate-300 mx-auto mb-2"
                        />
                        <p className="text-sm text-slate-400 font-medium">
                          No properties match your search.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pagination */}
              {filteredListings.length > ROWS_PER_PAGE && (
                <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
                  <p className="text-sm text-slate-400 font-medium">
                    Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}–
                    {Math.min(
                      currentPage * ROWS_PER_PAGE,
                      filteredListings.length,
                    )}{" "}
                    of {filteredListings.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="Previous page"
                    >
                      <IconChevronLeft size={16} />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (p) => (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={cn(
                            "size-8 flex items-center justify-center rounded-lg text-base font-medium transition-colors",
                            p === currentPage
                              ? "bg-[#151936] text-white"
                              : "text-slate-400 hover:bg-slate-100",
                          )}
                        >
                          {p}
                        </button>
                      ),
                    )}
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="Next page"
                    >
                      <IconChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activity Logs Tab */}
          {activeTab === "activity" && (
            <div className="gsap-stagger flex-1 overflow-y-auto custom-scrollbar space-y-0 mt-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="md" />
                </div>
              ) : (stats?.activityLogs || []).length > 0 ? (
                (stats?.activityLogs || []).map((log, i) => {
                  const LogIcon = LOG_ICONS[log.icon] || IconActivity;
                  return (
                    <div
                      key={log.id}
                      className="flex gap-3.5 relative py-3 animate-fade-in-up"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      {i < (stats?.activityLogs || []).length - 1 && (
                        <div className="absolute left-[15px] top-[36px] bottom-0 w-px bg-slate-100" />
                      )}
                      <div className="size-[30px] rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 z-10 text-slate-400 shadow-sm">
                        <LogIcon size={14} stroke={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-700 leading-snug font-medium text-base">
                          {log.text}
                        </p>
                        <p className="text-sm text-slate-400 mt-0.5">
                          {log.time}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <IconActivity size={28} className="text-slate-300 mb-2" />
                  <p className="text-base text-slate-400 font-medium">
                    No recent logs recorded.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === "transactions" && (
            <div className="gsap-stagger flex-1 overflow-y-auto custom-scrollbar space-y-0 mt-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="md" />
                </div>
              ) : (stats?.activityLogs || []).filter(
                (l) => l.type === "payment",
              ).length > 0 ? (
                (stats?.activityLogs || [])
                  .filter((l) => l.type === "payment")
                  .map((log, i) => {
                    const LogIcon = LOG_ICONS[log.icon] || IconReceipt;
                    return (
                      <div
                        key={log.id}
                        className="flex gap-3.5 py-3 border-b border-slate-50 animate-fade-in-up"
                        style={{ animationDelay: `${i * 40}ms` }}
                      >
                        <div className="size-[30px] rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-600 shadow-sm">
                          <LogIcon size={14} stroke={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-700 leading-snug font-medium text-base">
                            {log.text}
                          </p>
                          <p className="text-sm text-slate-400 mt-0.5">
                            {log.time}
                          </p>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <IconReceipt size={28} className="text-slate-300 mb-2" />
                  <p className="text-base text-slate-400 font-medium">
                    No recent transactions.
                  </p>
                </div>
              )}
              <Link href="/fin" className="block mt-4">
                <button className="w-full text-center text-base font-medium text-[#151936] hover:text-[#0f343a] transition-colors py-2 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-center gap-1.5">
                  View Full Ledger <IconArrowRight size={13} />
                </button>
              </Link>
            </div>
          )}
        </div>

        {/* Growth Widget */}
        <div className="p-6 xl:col-span-4 bg-white rounded-[20px] border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <GrowthWidget entityId={context} />
        </div>
      </section>

      {/* ── Market Insights ──────────────── */}
      <section className="w-full" aria-label="Market insights">
        <UnifiedMarketBoard
          initialListings={listings}
          revenueData={stats?.chartSeries || []}
        />
      </section>

      {/* ── Action & Health Center (Moved) ── */}
      {stats &&
        ((stats.awaitingMyDecision && stats.awaitingMyDecision.count > 0) ||
          (stats.systemHealth && currentUserRole === "ceo")) && (
          <section className="mt-12 pt-10 border-t border-slate-200/60 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
            {stats.awaitingMyDecision && stats.awaitingMyDecision.count > 0 && (
              <div className="bg-white border border-slate-100 p-6 sm:p-8 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)] transition-all group relative overflow-hidden z-0">
                <IconInbox
                  size={260}
                  stroke={1}
                  className="absolute -right-12 -bottom-12 text-slate-50 opacity-60 pointer-events-none group-hover:scale-105 group-hover:-rotate-3 transition-transform duration-700 -z-10"
                />
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div>
                    <h3 className="text-title-primary">Awaiting Decision</h3>
                    <p className="text-desc-secondary mt-1">
                      Pending requests requiring your action
                    </p>
                  </div>
                  <div className="size-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0 shadow-sm border border-amber-100/50 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                    <IconInbox size={24} stroke={1.5} />
                  </div>
                </div>
                <div className="space-y-4 mb-6 relative z-10">
                  {stats.awaitingMyDecision.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center text-body-regular border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm">
                          <IconFileText size={14} />
                        </div>
                        <div>
                          <span className="text-body-primary capitalize font-medium">
                            {item.requestType.replace(/_/g, " ")}
                          </span>
                          <p className="text-meta-muted mt-0.5 text-xs">
                            {new Date(item.requestedAt).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" },
                            )}
                          </p>
                        </div>
                      </div>
                      {item.amountKes !== null && (
                        <span className="mono-stat text-slate-900 tracking-tight text-sm bg-white/80 px-1 py-0.5 rounded">
                          {formatCompactKES(item.amountKes)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="relative z-10 mt-auto">
                  <Link
                    href="/admin/approvals"
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 hover:bg-[#f3df27] text-slate-700 hover:text-[#151936] text-sm font-medium rounded-lg transition-colors border border-slate-200/60 hover:border-transparent"
                  >
                    Review Queue <IconArrowRight size={14} />
                  </Link>
                </div>
              </div>
            )}

            {stats.systemHealth && currentUserRole === "ceo" && (
              <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-[24px] shadow-xl flex flex-col justify-between hover:shadow-2xl transition-all relative overflow-hidden group">
                <div className="absolute -right-12 -top-12 size-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-colors duration-700" />
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div>
                    <h3 className="text-white headline-md flex items-center gap-2.5">
                      System Health
                      <span className="relative flex size-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500"></span>
                      </span>
                    </h3>
                    <p className="body-sm text-slate-400 mt-1">
                      Real-time integrity monitoring
                    </p>
                  </div>
                  <div className="size-12 rounded-2xl bg-white/5 flex items-center justify-center text-emerald-400 shrink-0 border border-white/10 group-hover:bg-white/10 transition-colors shadow-sm">
                    <IconActivity size={24} stroke={1.5} />
                  </div>
                </div>
                <div className="space-y-6 relative z-10 mb-2 mt-auto">
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-3">
                      <p className="mono-stat text-white leading-none tracking-tight text-5xl">
                        {stats.systemHealth.activeUserCount}
                      </p>
                      <p className="body-md text-slate-400 font-medium">
                        Active Users
                      </p>
                    </div>
                    <div className="flex -space-x-4 mr-6">
                      <Image
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces&q=80"
                        width={40}
                        height={40}
                        alt="User"
                        className="size-10 rounded-full border-2 border-slate-900 object-cover"
                      />
                      <Image
                        src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=faces&q=80"
                        width={40}
                        height={40}
                        alt="User"
                        className="size-10 rounded-full border-2 border-slate-900 object-cover"
                      />
                      <Image
                        src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces&q=80"
                        width={40}
                        height={40}
                        alt="User"
                        className="size-10 rounded-full border-2 border-slate-900 object-cover"
                      />
                      <div className="size-10 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-white text-xs font-medium z-10">
                        +{Math.max(0, stats.systemHealth.activeUserCount - 3)}
                      </div>
                    </div>
                  </div>
                  <div className="pt-5 border-t border-white/10">
                    <p className="label-caps text-slate-400 mb-2.5">
                      Last Threshold Update
                    </p>
                    <div className="flex items-center gap-2 text-slate-300 text-xs uppercase tracking-wider mono-data bg-white/5 px-3 py-1.5 rounded-md border border-white/5 w-fit">
                      <IconCheck size={14} className="text-emerald-500" />
                      {stats.systemHealth.lastThresholdChangeAt
                        ? new Date(
                          stats.systemHealth.lastThresholdChangeAt,
                        ).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                        : "No updates"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {stats.departmentStats && (
              <div className="bg-white border border-slate-100 p-6 sm:p-8 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)] transition-all group relative overflow-hidden z-0">
                <IconBriefcase
                  size={260}
                  stroke={1}
                  className="absolute -right-16 -bottom-12 text-slate-50 opacity-60 pointer-events-none group-hover:scale-105 group-hover:rotate-3 transition-transform duration-700 -z-10"
                />
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div>
                    <h3 className="text-title-primary">Organizational Load</h3>
                    <p className="text-desc-secondary mt-1">
                      Active projects by division
                    </p>
                  </div>
                  <div className="size-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0 shadow-sm border border-indigo-100/50 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                    <IconBriefcase size={24} stroke={1.5} />
                  </div>
                </div>

                <div className="space-y-3 mb-6 relative z-10">
                  <div className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50/80 transition-colors backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="size-2 rounded-full bg-teal-500 shadow-sm" />
                      <span className="text-body-primary font-medium">
                        Property Management
                      </span>
                    </div>
                    <span className="mono-stat text-slate-900 bg-white/80 px-1.5 py-0.5 rounded">
                      {stats.departmentStats.sales}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50/80 transition-colors backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="size-2 rounded-full bg-amber-500 shadow-sm" />
                      <span className="text-body-primary font-medium">
                        Operations
                      </span>
                    </div>
                    <span className="mono-stat text-slate-900 bg-white/80 px-1.5 py-0.5 rounded">
                      {stats.departmentStats.ops}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50/80 transition-colors backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="size-2 rounded-full bg-indigo-500 shadow-sm" />
                      <span className="text-body-primary font-medium">
                        Legal & Compliance
                      </span>
                    </div>
                    <span className="mono-stat text-slate-900 bg-white/80 px-1.5 py-0.5 rounded">
                      {stats.departmentStats.legal}
                    </span>
                  </div>
                </div>
                <div className="relative z-10 mt-auto">
                  <Link
                    href="/admin/operations"
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-sm font-medium rounded-lg transition-colors border border-slate-200/60"
                  >
                    View Operations <IconArrowRight size={14} />
                  </Link>
                </div>
              </div>
            )}
          </section>
        )}

      {/* ── Modals & Drawers ────────────── */}
      <PropertyFormModal
        open={propertyModalOpen}
        onClose={() => {
          setPropertyModalOpen(false);
          setEditingProperty(null);
        }}
        onSubmit={handlePropertySaved}
        initialData={
          editingProperty
            ? {
              id: editingProperty.id,
              name: editingProperty.name,
              location: editingProperty.location,
              type: editingProperty.type,
              status: editingProperty.status,
              price: editingProperty.price,
              roi: editingProperty.roi,
              imageUrl: editingProperty.imageUrl,
            }
            : undefined
        }
        mode={propertyModalMode}
      />

      <PropertyDetailDrawer
        open={!!drawerProperty}
        onClose={() => setDrawerProperty(null)}
        // Map the dashboard-local PropertyListing shape to the drawer's Property contract.
        // The drawer accesses: id, name, location, propertyType, listingType, status, isFeatured, media.
        // PropertyListing only carries {id,name,location,type,status,roi,price,imageUrl} - we
        // shim the rest with safe defaults so nothing renders broken.
        property={drawerProperty ? {
          id: drawerProperty.id,
          name: drawerProperty.name,
          location: drawerProperty.location,
          propertyType: drawerProperty.type,
          listingType: "let" as const,
          status: drawerProperty.status === "Occupied"
            ? "occupied"
            : drawerProperty.status === "Under Offer"
              ? "under_offer"
              : drawerProperty.status === "Sold"
                ? "off_market"
                : "available",
          propertyCode: "",
          ownerContactId: null,
          askingPriceKes: null,
          monthlyRentKes: drawerProperty.price ?? null,
          bedrooms: null,
          bathrooms: null,
          sizeSqft: null,
          isFeatured: false,
          media: drawerProperty.imageUrl
            ? [{ url: drawerProperty.imageUrl, isPrimary: true }]
            : [],
        } : null}
        canManage={false}
        onStatusChange={() => { }}
        onEdit={(prop) => {
          const original = listings.find((l) => l.id === prop.id);
          if (original) {
            setEditingProperty(original);
            setPropertyModalMode("edit");
            setPropertyModalOpen(true);
            setDrawerProperty(null);
          }
        }}
        onDelete={(id) => {
          setDeleteConfirmId(id);
          setDrawerProperty(null);
        }}
      />

      <ConfirmDialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDeleteProperty}
        isLoading={isDeleting}
        title="Remove Property"
        description={`Are you sure you want to remove "${listings.find((l) => l.id === deleteConfirmId)?.name ?? "this property"}" from the portfolio?`}
        confirmLabel="Remove Property"
        tone="danger"
      />

      {/* Click-away handler for row menus */}
      {rowMenuOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setRowMenuOpen(null)}
          aria-hidden="true"
        />
      )}
    </PageTransition>
  );
}
