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
  IconFileCheck,
  IconHomePlus,
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
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils/cn";
import { formatCompactKES } from "@/lib/utils/format";
import { useToast } from "@/components/ui/toast-provider";
import { PropertyFormModal } from "./property-form-modal";
import { PropertyDetailDrawer } from "./property-detail-drawer";
import { ApprovalQueue } from "./approval-queue";

// Dynamically import client-side chart and helper components with SSR disabled
const SalesChart = dynamic(() => import("./sales-chart"), { ssr: false });
const RadialProgress = dynamic(() => import("./radial-progress"), { ssr: false });
const GrowthWidget = dynamic(() => import("./growth-widget"), { ssr: false });
const UnifiedMarketBoard = dynamic(() => import("./unified-market-board").then(m => ({ default: m.UnifiedMarketBoard })), { ssr: false });
const InternalOperationsBoard = dynamic(() => import("./internal-operations-board").then(m => ({ default: m.InternalOperationsBoard })), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface PropertyListing {
  id: string;
  name: string;
  location: string;
  type: string;
  status: "Available" | "Sold" | "Under Offer" | "Occupied";
  roi: string;
  price: string;
  imageUrl: string;
}

interface ActivityLogItem {
  id: string;
  time: string;
  text: string;
  type: "call" | "viewing" | "payment" | "update" | "system";
  icon: "phone" | "eye" | "receipt" | "edit" | "activity";
}

// ─── Data Registry ────────────────────────────────────────────────────────────

const FEATURED_PROPERTIES = {
  group: { name: "Runda Grove Villa", location: "Runda, Nairobi", price: "KES 21,300,000", roi: "12.0% ROI", imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80", status: "Available" as const },
  commercial: { name: "Westlands Tower 4B", location: "Westlands, Nairobi", price: "KES 720,000 / mo", roi: "9.6% Yield", imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80", status: "Occupied" as const },
  residential: { name: "Karen Ridge House", location: "Karen, Nairobi", price: "KES 62,000,000", roi: "8.4% ROI", imageUrl: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=80", status: "Under Offer" as const },
};

const CHART_DATA = {
  group: [
    { day: "Mon", Revenue: 1400000, Sales: 45, Visitors: 1200 },
    { day: "Tue", Revenue: 900000, Sales: 28, Visitors: 850 },
    { day: "Wed", Revenue: 1100000, Sales: 34, Visitors: 920 },
    { day: "Thu", Revenue: 800000, Sales: 22, Visitors: 710 },
    { day: "Fri", Revenue: 1050000, Sales: 31, Visitors: 890 },
  ],
  commercial: [
    { day: "Mon", Revenue: 550000, Sales: 18, Visitors: 470 },
    { day: "Tue", Revenue: 350000, Sales: 11, Visitors: 330 },
    { day: "Wed", Revenue: 430000, Sales: 13, Visitors: 360 },
    { day: "Thu", Revenue: 310000, Sales: 9, Visitors: 280 },
    { day: "Fri", Revenue: 410000, Sales: 12, Visitors: 350 },
  ],
  residential: [
    { day: "Mon", Revenue: 850000, Sales: 27, Visitors: 730 },
    { day: "Tue", Revenue: 550000, Sales: 17, Visitors: 520 },
    { day: "Wed", Revenue: 670000, Sales: 21, Visitors: 560 },
    { day: "Thu", Revenue: 490000, Sales: 13, Visitors: 430 },
    { day: "Fri", Revenue: 640000, Sales: 19, Visitors: 540 },
  ],
};

const INITIAL_LISTINGS: Record<string, PropertyListing[]> = {
  group: [
    { id: "p1", name: "Runda Grove Villa", location: "Runda, Nairobi", type: "Premium Estate", status: "Available", roi: "12.0%", price: "KES 21.3M", imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "p2", name: "Westlands Tower 4B", location: "Westlands, Nairobi", type: "Office Suite", status: "Occupied", roi: "9.6%", price: "KES 720K/mo", imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "p3", name: "Karen Ridge House", location: "Karen, Nairobi", type: "Luxury Villa", status: "Under Offer", roi: "8.4%", price: "KES 62M", imageUrl: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "p4", name: "Upper Hill Plaza", location: "Upper Hill, Nairobi", type: "Office Floor", status: "Available", roi: "11.2%", price: "KES 120M", imageUrl: "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "p5", name: "Kilimani Heights", location: "Kilimani, Nairobi", type: "Apartment", status: "Available", roi: "6.8%", price: "KES 14M", imageUrl: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "p6", name: "Lavington Gardens", location: "Lavington, Nairobi", type: "Townhouse", status: "Sold", roi: "5.0%", price: "KES 48M", imageUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "p7", name: "Riverside Haven", location: "Riverside, Nairobi", type: "Executive Studio", status: "Available", roi: "4.0%", price: "KES 8.5M", imageUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "p8", name: "Muthaiga Grand", location: "Muthaiga, Nairobi", type: "Premium Estate", status: "Occupied", roi: "7.2%", price: "KES 150M", imageUrl: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "p9", name: "Gigiri Diplomatic", location: "Gigiri, Nairobi", type: "Apartment", status: "Under Offer", roi: "8.1%", price: "KES 35M", imageUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=120&h=80&q=80" },
  ],
  commercial: [
    { id: "c1", name: "Westlands Tower 4B", location: "Westlands, Nairobi", type: "Office Suite", status: "Occupied", roi: "9.6%", price: "KES 720K/mo", imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "c2", name: "Upper Hill Plaza", location: "Upper Hill, Nairobi", type: "Office Floor", status: "Available", roi: "11.2%", price: "KES 120M", imageUrl: "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "c3", name: "Kilimani Office Suite", location: "Kilimani, Nairobi", type: "Office Space", status: "Available", roi: "8.8%", price: "KES 45M", imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "c4", name: "Westlands Retail Ground", location: "Westlands, Nairobi", type: "Showroom", status: "Under Offer", roi: "7.5%", price: "KES 95M", imageUrl: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "c5", name: "Industrial Area Depot", location: "Industrial Area", type: "Warehouse", status: "Available", roi: "10.4%", price: "KES 160M", imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=120&h=80&q=80" },
  ],
  residential: [
    { id: "r1", name: "Runda Grove Villa", location: "Runda, Nairobi", type: "Premium Estate", status: "Available", roi: "12.0%", price: "KES 21.3M", imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "r2", name: "Karen Ridge House", location: "Karen, Nairobi", type: "Luxury Villa", status: "Under Offer", roi: "8.4%", price: "KES 62M", imageUrl: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "r3", name: "Kilimani Heights", location: "Kilimani, Nairobi", type: "Apartment", status: "Available", roi: "6.8%", price: "KES 14M", imageUrl: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "r4", name: "Lavington Gardens", location: "Lavington, Nairobi", type: "Townhouse", status: "Sold", roi: "5.0%", price: "KES 48M", imageUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "r5", name: "Riverside Haven", location: "Riverside, Nairobi", type: "Executive Studio", status: "Available", roi: "4.0%", price: "KES 8.5M", imageUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=120&h=80&q=80" },
  ],
};

const ACTIVITY_LOGS: ActivityLogItem[] = [
  { id: "al1", time: "10 min ago", text: "Amina completed viewing at Karen Ridge House with James M.", type: "viewing", icon: "eye" },
  { id: "al2", time: "25 min ago", text: "KES 720,000 rent payment received — Westlands Tower 4B", type: "payment", icon: "receipt" },
  { id: "al3", time: "1 hour ago", text: "New lead inquiry: 3BR apartment in Kilimani", type: "call", icon: "phone" },
  { id: "al4", time: "2 hours ago", text: "Upper Hill Plaza status changed to Available", type: "update", icon: "edit" },
  { id: "al5", time: "3 hours ago", text: "Monthly portfolio report generated", type: "system", icon: "activity" },
  { id: "al6", time: "5 hours ago", text: "Escrow signing completed — Muthaiga Grand Estate", type: "system", icon: "activity" },
  { id: "al7", time: "Yesterday", text: "Client follow-up call with Ruth Wanjiku — lease renewal", type: "call", icon: "phone" },
  { id: "al8", time: "Yesterday", text: "KES 208,000 rent payment received — Kilimani Heights", type: "payment", icon: "receipt" },
];

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

export function DashboardOverview({ entityId = "group" }: { entityId?: string }) {
  const [mounted, setMounted] = useState(false);
  const { pushToast } = useToast();

  // Entity context
  const context = (entityId === "commercial" || entityId === "residential") ? entityId : "group";

  // Listing Board state
  const [listings, setListings] = useState<PropertyListing[]>(INITIAL_LISTINGS[context] ?? INITIAL_LISTINGS.group);
  const [activeTab, setActiveTab] = useState<"listings" | "activity" | "transactions">("listings");
  const [listingSearch, setListingSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<keyof PropertyListing | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [rowMenuOpen, setRowMenuOpen] = useState<string | null>(null);

  // CRUD state
  const [propertyModalOpen, setPropertyModalOpen] = useState(false);
  const [propertyModalMode, setPropertyModalMode] = useState<"create" | "edit">("create");
  const [editingProperty, setEditingProperty] = useState<PropertyListing | null>(null);
  const [drawerProperty, setDrawerProperty] = useState<PropertyListing | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Revenue chart state
  const [chartFilter, setChartFilter] = useState<"all" | "Revenue" | "Sales" | "Visitors">("all");
  const [chartPeriod, setChartPeriod] = useState<"week" | "month" | "quarter">("week");

  // Last refreshed
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [prevContext, setPrevContext] = useState(context);

  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);

    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.user?.role) {
          setCurrentUserRole(data.user.role);
        }
      })
      .catch(() => { });

    return () => clearTimeout(t);
  }, []);

  // Reset listings when entity changes (adjusted during render to avoid cascading updates)
  if (context !== prevContext) {
    setPrevContext(context);
    setListings(INITIAL_LISTINGS[context] ?? INITIAL_LISTINGS.group);
    setCurrentPage(1);
    setListingSearch("");
  }

  // Context metrics (KES standardized)
  const isComm = context === "commercial";
  const isRes = context === "residential";

  const metrics = {
    activeListings: isComm ? "96" : isRes ? "152" : "248",
    activeTrend: isComm ? "+12%" : isRes ? "+22%" : "+18%",
    revenueMtd: isComm ? "KES 16.7M" : isRes ? "KES 26.1M" : "KES 42.8M",
    revenueTrend: isComm ? "+8.2%" : isRes ? "+14.8%" : "+12.4%",
    closedDeals: isComm ? "37" : isRes ? "59" : "96",
    closedTrend: isComm ? "+12%" : isRes ? "+16%" : "+12%",
    newDeals: isComm ? "483" : isRes ? "757" : "1,240",
    newDealsTrend: isComm ? "18%" : isRes ? "25%" : "22%",
    radialVal: isComm ? "4,847" : isRes ? "7,583" : "12,430",
    radialPct: isComm ? 86 : isRes ? 95 : 93,
    radialSub: isComm ? "commercial leases added" : isRes ? "residential leases added" : "monthly added units",
    income: isComm ? 16700000 : isRes ? 26100000 : 42800000,
    expenses: isComm ? 11200000 : isRes ? 17400000 : 28600000,
    profit: isComm ? 5500000 : isRes ? 8700000 : 14200000,
    incomeGrowth: isComm ? 8.2 : isRes ? 14.8 : 12.4,
    expenseGrowth: isComm ? -3.1 : isRes ? -5.2 : -4.1,
    profitGrowth: isComm ? 11.3 : isRes ? 9.6 : 8.3,
    newLeads: isComm ? "142" : isRes ? "318" : "460",
    newLeadsGrowth: "+28",
    siteInquiries: isComm ? "892" : isRes ? "1,647" : "2,539",
    inquiryRate: isComm ? "24.8%" : isRes ? "38.2%" : "32.4%",
  };

  const featured = FEATURED_PROPERTIES[context];
  const chartData = CHART_DATA[context];

  // ─── Listing Board Logic ─────────────────────────────

  const filteredListings = useMemo(() => {
    let result = listings.filter((l) =>
      l.name.toLowerCase().includes(listingSearch.toLowerCase()) ||
      l.location.toLowerCase().includes(listingSearch.toLowerCase()) ||
      l.type.toLowerCase().includes(listingSearch.toLowerCase())
    );
    if (sortField) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [listings, listingSearch, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredListings.length / ROWS_PER_PAGE));
  const paginatedListings = filteredListings.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
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

  const handleCreateProperty = (data: { name: string; location: string; type: string; status: PropertyListing["status"]; roi?: string; price: string; imageUrl?: string }) => {
    const newProp: PropertyListing = {
      id: `p${Date.now()}`,
      name: data.name,
      location: data.location,
      type: data.type,
      status: data.status,
      roi: data.roi || "—",
      price: data.price,
      imageUrl: data.imageUrl || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=120&h=80&q=80",
    };
    setListings((prev) => [newProp, ...prev]);
    setCurrentPage(1);
  };

  const handleEditProperty = (data: { name: string; location: string; type: string; status: PropertyListing["status"]; roi?: string; price: string; imageUrl?: string }) => {
    setListings((prev) =>
      prev.map((p) =>
        p.id === editingProperty?.id
          ? { ...p, name: data.name, location: data.location, type: data.type, status: data.status, roi: data.roi || p.roi, price: data.price }
          : p
      )
    );
  };

  const handleDeleteProperty = useCallback(async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    await new Promise((r) => setTimeout(r, 600));
    const name = listings.find((l) => l.id === deleteConfirmId)?.name;
    setListings((prev) => prev.filter((p) => p.id !== deleteConfirmId));
    pushToast({ tone: "success", title: "Property Removed", body: `${name} has been removed from the portfolio.` });
    setIsDeleting(false);
    setDeleteConfirmId(null);
    setRowMenuOpen(null);
  }, [deleteConfirmId, listings, pushToast]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise((r) => setTimeout(r, 1200));
    setLastRefreshed(new Date());
    setIsRefreshing(false);
    pushToast({ tone: "info", title: "Dashboard Refreshed", body: "All metrics updated to latest data." });
  };

  // Sort indicator
  const SortIndicator = ({ field }: { field: keyof PropertyListing }) => (
    sortField === field ? (
      <span className="ml-1 text-sm">{sortDir === "asc" ? "▲" : "▼"}</span>
    ) : null
  );

  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-3 transition-opacity duration-300">
      {/* ── Hero Command Title ──────────────────────────────── */}
      <section className="relative z-10 flex flex-col gap-1 border-b border-slate-200/60 pb-3 animate-fade-in-up" aria-label="Dashboard header">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <Badge tone="primary" className="font-medium tracking-wide">
              {isComm ? "Commercial Operations" : isRes ? "Residential Operations" : "Consolidated Group"}
            </Badge>
            <span className="text-slate-400 hidden sm:inline mono-data">
              Updated {mounted ? lastRefreshed.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={cn(
                "flex items-center gap-1.5 text-base font-medium text-slate-500 hover:text-slate-800 transition-colors bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm hover:shadow",
                isRefreshing && "opacity-60"
              )}
              aria-label="Refresh dashboard"
            >
              <IconRefresh size={13} stroke={2} className={cn(isRefreshing && "animate-spin")} />
              Refresh
            </button>
            <div className="relative group">
              <button className="flex items-center gap-1.5 text-base font-medium text-[#151936] bg-[#f3df27] px-3 py-1.5 rounded-lg shadow-sm hover:bg-[#e6d220] transition-colors">
                <IconPlus size={13} stroke={2.5} />
                Quick Action
              </button>
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 py-1">
                <Link href="/admin/properties" className="flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-base">
                  <IconBuildingSkyscraper size={14} /> Add Property
                </Link>
                <Link href="/admin/contacts" className="flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-base">
                  <IconPlus size={14} /> Add Contact
                </Link>
                <Link href="/fin" className="flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-base">
                  <IconReceipt size={14} /> Record Payment
                </Link>
                <Link href="/admin/pipeline" className="flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-base">
                  <IconCalendarEvent size={14} /> Schedule Viewing
                </Link>
              </div>
            </div>
          </div>
        </div>
        <h1 className="title-serif text-slate-900 mt-2">
          {isComm ? "Commercial Portfolio Command" : isRes ? "Residential Portfolio Command" : "Real Estate Management Command"}
        </h1>
        <p className="text-base text-slate-500 max-w-3xl leading-relaxed mt-1">
          Monitor transactional metrics, manage dynamic property listings, evaluate sales analytics
          pipelines, and coordinate operational tasks from this unified command center.
        </p>
      </section>

      {/* Dynamic Approvals Queue for CEO and GM */}
      {(currentUserRole === "ceo" || currentUserRole === "general_manager") && (
        <section className="w-full mt-2" aria-label="Approvals Queue">
          <ApprovalQueue />
        </section>
      )}

      {/* ── Grid Row 1: Key Performance Metrics ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 my-10" aria-label="Key performance indicators">
        {/* Col 1: Active Listings + Revenue (Stacked) */}
        <div className="flex flex-col gap-3">
          <Link href="/admin/properties" className="animate-fade-in-up stagger-1">
            <div className="relative p-5 rounded-[20px] bg-[#e1f3f6] h-[155px] flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group">
              <div className="flex items-center gap-2">
                <div className="size-[22px] rounded-full bg-[#151936] flex items-center justify-center text-white">
                  <IconBuildingSkyscraper size={12} stroke={2.5} />
                </div>
                <span className="text-base font-normal text-[#2e626a] tracking-wide">Active Listings</span>
                <IconArrowUpRight size={12} className="ml-auto text-[#2e626a] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex items-end justify-between mt-auto mb-3">
                <span className="text-[#151936] tracking-tight leading-none mono-stat">{metrics.activeListings}</span>
                <span className="text-sm font-medium text-[#2e626a] mb-0.5">{metrics.activeTrend}</span>
              </div>
              <div className="h-[4px] bg-[#c3e3e8] rounded-full overflow-hidden w-full">
                <div className="h-full bg-[#3f919d] rounded-full w-[75%] transition-all duration-1000" />
              </div>
            </div>
          </Link>

          <Link href="/fin" className="animate-fade-in-up stagger-2">
            <div className="relative p-5 rounded-[20px] bg-[#e6f4ea] h-[155px] flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group">
              <div className="flex items-center gap-2">
                <div className="size-[22px] rounded-full bg-[#1b431e] flex items-center justify-center text-white">
                  <IconCoin size={13} stroke={2.5} />
                </div>
                <span className="text-base font-normal text-[#336336] tracking-wide">Total Revenue</span>
                <IconArrowUpRight size={12} className="ml-auto text-[#336336] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex items-end justify-between mt-auto mb-3">
                <span className="text-[#1b431e] tracking-tight leading-none mono-stat">{metrics.revenueMtd}</span>
                <span className="text-sm font-medium text-[#336336] mb-0.5">{metrics.revenueTrend}</span>
              </div>
              <div className="h-[4px] bg-[#c6e0c7] rounded-full overflow-hidden w-full">
                <div className="h-full bg-[#48954b] rounded-full w-[82%] transition-all duration-1000" />
              </div>
            </div>
          </Link>
        </div>

        {/* Col 2-3: Featured Property */}
        <Card className="xl:col-span-2 h-[326px] bg-slate-900 border-none hover:shadow-md transition-all overflow-hidden relative group flex flex-col justify-between animate-fade-in-up stagger-3">
          <div className="absolute inset-0 z-0">
            <Image src={featured.imageUrl} alt={featured.name} fill sizes="(max-width: 1024px) 100vw, 600px" className="object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/45 to-slate-950/30" />
          </div>
          <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between z-10">
            <span className="backdrop-blur-md bg-white/10 text-white border border-white/20 px-2.5 py-1 rounded-md label-caps">Featured Property</span>
            <Link href="/admin/properties" className="backdrop-blur-md bg-white/10 text-white hover:bg-white/20 border border-white/20 text-sm px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-all">
              View All <IconArrowUpRight size={13} />
            </Link>
          </div>
          <div className="absolute bottom-0 inset-x-0 p-5 flex flex-col justify-end text-white z-10">
            <div>
              <p className="text-[var(--primary)] sm:text-[26px] tracking-tight leading-none mono-stat">{featured.price}</p>
              <h3 className="text-lg font-medium text-white mt-1.5 leading-snug">{featured.name}</h3>
              <p className="text-sm  text-slate-300 font-medium mt-0.5 uppercase tracking-wide">{featured.location}</p>
            </div>
            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/10">
              <span className={cn("text-sm  px-2.5 py-0.5 rounded-full border font-medium uppercase tracking-wider", STATUS_DARK_TONES[featured.status])}>{featured.status}</span>
              <span className="text-sm  font-mono text-slate-300 font-medium">{featured.roi}</span>
              <button
                onClick={() => setDrawerProperty({ id: "featured", ...featured, roi: featured.roi.replace(" ROI", "").replace(" Yield", ""), type: "Premium Estate" })}
                className="focus-ring ml-auto inline-flex h-8.5 items-center justify-center rounded-lg bg-white text-slate-900 px-4 text-sm  font-medium transition hover:bg-slate-100"
              >
                More Details
              </button>
            </div>
          </div>
        </Card>

        {/* Col 4: Closed Deals + New Deals */}
        <div className="flex flex-col gap-3">
          <Link href="/admin/pipeline?stage=closed_won" className="animate-fade-in-up stagger-4">
            <div className="relative p-5 rounded-[20px] bg-[#fcf0e4] h-[155px] flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group">
              <div className="flex items-center gap-2">
                <div className="size-[22px] rounded-full bg-[#5e2b17] flex items-center justify-center text-white"><IconFileCheck size={13} stroke={2.5} /></div>
                <span className="text-base font-normal text-[#824429] tracking-wide">Closed Deals</span>
                <IconArrowUpRight size={12} className="ml-auto text-[#824429] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex items-end justify-between mt-auto mb-3">
                <span className="text-[#5e2b17] tracking-tight leading-none mono-stat">{metrics.closedDeals}</span>
                <span className="text-sm font-medium text-[#824429] mb-0.5">{metrics.closedTrend}</span>
              </div>
              <div className="h-[4px] bg-[#f2d8c9] rounded-full overflow-hidden w-full"><div className="h-full bg-[#c96f45] rounded-full w-[60%]" /></div>
            </div>
          </Link>

          <Link href="/admin/pipeline" className="animate-fade-in-up stagger-5">
            <div className="relative p-5 rounded-[20px] bg-[#eef2f6] h-[155px] flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group">
              <div className="flex items-center gap-2">
                <div className="size-[22px] rounded-full bg-[#24354a] flex items-center justify-center text-white"><IconHomePlus size={13} stroke={2.5} /></div>
                <span className="text-base font-normal text-[#415671] tracking-wide">New Deals</span>
                <IconArrowUpRight size={12} className="ml-auto text-[#415671] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex items-end justify-between mt-auto mb-3">
                <span className="text-[#24354a] tracking-tight leading-none mono-stat">{metrics.newDeals}</span>
                <span className="text-sm font-medium text-[#415671] mb-0.5">{metrics.newDealsTrend}</span>
              </div>
              <div className="h-[4px] bg-[#d2dde8] rounded-full overflow-hidden w-full"><div className="h-full bg-[#5a7c9f] rounded-full w-[45%]" /></div>
            </div>
          </Link>
        </div>

        {/* Col 5: Radial */}
        <Card className="p-5 flex flex-col justify-between items-center h-[326px] bg-white border border-slate-100 hover:shadow-md transition-all animate-fade-in-up stagger-6">
          <p className="text-base font-medium text-slate-500 uppercase tracking-wider">New Units Added</p>
          {mounted ? (
            <RadialProgress percentage={metrics.radialPct} valueLabel={metrics.radialVal} subtitle={metrics.radialSub} />
          ) : (
            <div className="flex-1 flex items-center justify-center"><div className="skeleton-shimmer h-36 w-36 rounded-full" /></div>
          )}
        </Card>
      </section>

      {/* ── Internal Structure & Scheduler ─────────── */}
      <section className="w-full" aria-label="Internal operations">
        <InternalOperationsBoard />
      </section>

      {/* ── Revenue Analytics ─ */}
      <div className="pt-6 border-t border-slate-200/60 my-4">
        <h2 className="title-serif text-slate-900">Operational Analytics & Insights</h2>
        <p className="text-base text-slate-500 font-medium tracking-wide mt-1">Deep-dive into revenue trends and core performance metrics.</p>
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch" aria-label="Revenue analytics">
        <div className="p-6 xl:col-span-8 flex flex-col justify-between bg-white rounded-[20px] border border-slate-100 shadow-sm hover:shadow-md transition-all min-h-[420px]">
          <div>
            <div className="flex items-center justify-between mb-8 flex-wrap gap-2">
              <h2 className="text-slate-800 font-medium tracking-tight text-xl">Revenue</h2>
              <div className="flex items-center gap-2">
                {/* Period selector */}
                <div className="flex items-center gap-1 bg-slate-50/80 p-1 rounded-lg">
                  {(["week", "month", "quarter"] as const).map((p) => (
                    <button key={p} onClick={() => setChartPeriod(p)} className={cn("text-sm px-2.5 py-1 rounded-md font-medium transition-all capitalize", chartPeriod === p ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-slate-800" : "text-slate-500 hover:text-slate-700")}>
                      This {p}
                    </button>
                  ))}
                </div>
                {/* Data filter */}
                <div className="flex items-center gap-1 bg-slate-50/80 p-1 rounded-lg">
                  {(["all", "Revenue", "Sales", "Visitors"] as const).map((f) => (
                    <button key={f} onClick={() => setChartFilter(f)} className={cn("text-sm  px-3 py-1.5 rounded-md transition-all font-medium tracking-wide", chartFilter === f ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-slate-800" : "text-slate-500 hover:text-slate-700")}>
                      {f === "all" ? "All" : f}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-10 mb-6 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="size-[34px] rounded-[10px] bg-[#e1f3f6] flex items-center justify-center text-[#151936]"><IconCoin size={18} stroke={2} /></div>
                <div>
                  <p className="text-slate-500 font-medium mb-0.5 text-base">Income</p>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-800 font-medium font-mono leading-none tracking-tight text-2xl">{formatCompactKES(metrics.income)}</span>
                    <span className="text-sm font-medium text-emerald-600 flex items-center">{metrics.incomeGrowth}% <IconTrendingUp size={12} className="ml-0.5" /></span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="size-[34px] rounded-[10px] bg-[#fcf0e4] flex items-center justify-center text-[#c96f45]"><IconWallet size={18} stroke={2} /></div>
                <div>
                  <p className="text-slate-500 font-medium mb-0.5 text-base">Expenses</p>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-800 font-medium font-mono leading-none tracking-tight text-2xl">{formatCompactKES(metrics.expenses)}</span>
                    <span className="text-sm font-medium text-rose-600 flex items-center">{Math.abs(metrics.expenseGrowth)}% <IconTrendingDown size={12} className="ml-0.5" /></span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="size-[34px] rounded-[10px] bg-[#eef2f6] flex items-center justify-center text-[#5a7c9f]"><IconChartLine size={18} stroke={2} /></div>
                <div>
                  <p className="text-slate-500 font-medium mb-0.5 text-base">Profit</p>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-800 font-medium font-mono leading-none tracking-tight text-2xl">{formatCompactKES(metrics.profit)}</span>
                    <span className="text-sm font-medium text-emerald-600 flex items-center">{metrics.profitGrowth}% <IconTrendingUp size={12} className="ml-0.5" /></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[200px] flex items-end">
            {mounted ? <SalesChart data={chartData} activeFilter={chartFilter} /> : <div className="h-full w-full skeleton-shimmer rounded-xl" />}
          </div>
        </div>

        {/* Stats Column */}
        <div className="xl:col-span-4 flex flex-col gap-3">
          {/* Sales Statistic — KES */}
          <Link href="/fin" className="block">
            <div className="p-6 bg-white rounded-[20px] shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all h-[132px] group cursor-pointer">
              <div className="flex items-center justify-between">
                <h3 className="text-slate-800 font-medium tracking-wide body-md">Sales Performance</h3>
                <IconArrowUpRight size={14} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex items-end justify-between mt-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500"><IconCoin size={20} stroke={1.5} /></div>
                  <div>
                    <p className="text-sm  text-slate-400 font-medium mb-0.5">Total Profit</p>
                    <p className="text-slate-800 font-medium font-mono leading-none tracking-tight text-2xl">{formatCompactKES(metrics.profit)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm  text-slate-400 font-medium">Target</p>
                    <span className="text-sm font-medium text-emerald-600 flex items-center bg-emerald-50 px-1.5 rounded">{formatCompactKES(metrics.income)} <IconTrendingUp size={10} className="ml-0.5" /></span>
                  </div>
                  <div className="w-[100px] h-[3px] bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full w-[65%]" /></div>
                </div>
              </div>
            </div>
          </Link>

          {/* Site Inquiries — CRM Relevant */}
          <div className="p-6 bg-white rounded-[20px] shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all h-[132px]">
            <h3 className="text-slate-800 font-medium tracking-wide body-md">Site Inquiries</h3>
            <div className="flex items-end justify-between mt-2">
              <div className="flex-1">
                <p className="text-sm text-slate-400 font-medium mb-2">Property inquiries this week</p>
                <div className="flex items-center gap-3">
                  <span className="text-slate-800 leading-none tracking-tight mono-stat">{metrics.siteInquiries}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm  text-slate-400 font-medium mb-0.5">Conversion</p>
                <p className="text-[#5a7c9f] leading-none tracking-tight bg-[#eef2f6] px-2 py-1 rounded-md mono-stat">{metrics.inquiryRate}</p>
              </div>
            </div>
          </div>

          {/* New Leads — CRM Relevant */}
          <Link href="/admin/pipeline" className="block">
            <div className="p-6 bg-white rounded-[20px] shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all h-[132px] group cursor-pointer">
              <div className="flex items-center justify-between">
                <h3 className="text-slate-800 font-medium tracking-wide body-md">New Leads</h3>
                <span className="text-sm font-medium text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">{metrics.newLeads}</span>
              </div>
              <div className="flex items-end justify-between mt-2">
                <div>
                  <p className="text-sm text-slate-400 font-medium max-w-[120px] leading-snug mb-2">Pipeline conversion this month.</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-800 leading-none tracking-tight mono-stat">{metrics.newLeads}</span>
                    <span className="text-sm font-medium text-emerald-600 flex items-center bg-emerald-50 px-1.5 rounded"><IconTrendingUp size={10} className="mr-0.5" /> {metrics.newLeadsGrowth}</span>
                  </div>
                </div>
                <div className="flex items-end gap-1.5 h-12">
                  <div className="w-[18px] h-[30%] bg-slate-100 rounded-t-md" />
                  <div className="w-[18px] h-[50%] bg-slate-200 rounded-t-md" />
                  <div className="w-[18px] h-[70%] bg-slate-200 rounded-t-md" />
                  <div className="w-[18px] h-[100%] bg-[#5a7c9f] rounded-t-md" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ── Listing Board + Growth Widget ─ */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch mt-1" aria-label="Property listing board">
        <div className="p-6 xl:col-span-8 flex flex-col justify-between bg-white rounded-[20px] border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden min-h-[420px]">
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-slate-800 font-medium tracking-wide text-lg">Listing Board</h2>
              <div className="flex items-center gap-2">
                {/* Tab switcher */}
                <div className="flex items-center gap-1 bg-slate-50/80 p-1 rounded-lg">
                  {(["listings", "activity", "transactions"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                      className={cn(
                        "text-base px-3 py-1.5 rounded-md transition-all font-medium tracking-wide capitalize",
                        activeTab === tab ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-slate-800" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      {tab === "activity" ? "Activity Logs" : tab === "transactions" ? "Transactions" : "Listings"}
                    </button>
                  ))}
                </div>
                {activeTab === "listings" && (
                  <button
                    onClick={() => { setPropertyModalMode("create"); setEditingProperty(null); setPropertyModalOpen(true); }}
                    className="flex items-center gap-1.5 text-base font-medium text-[#151936] bg-[#f3df27] px-3 py-1.5 rounded-lg shadow-sm hover:bg-[#e6d220] transition-colors"
                  >
                    <IconPlus size={13} stroke={2.5} />
                    Add Property
                  </button>
                )}
              </div>
            </div>

            {/* Search (listings only) */}
            {activeTab === "listings" && (
              <div className="relative mb-3">
                <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search properties…"
                  value={listingSearch}
                  onChange={(e) => { setListingSearch(e.target.value); setCurrentPage(1); }}
                  onKeyDown={(e) => { if (e.key === "Escape") setListingSearch(""); }}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-100 bg-slate-50/50 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/30 transition-colors text-base"
                />
              </div>
            )}
          </div>

          {/* Listings Tab */}
          {activeTab === "listings" && (
            <div className="flex-1 flex flex-col">
              <div className="flex-1 overflow-x-auto [scrollbar-width:thin] mt-1">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-100/60 text-slate-400 label-caps">
                      {([
                        ["name", "Property Name"],
                        ["location", "Location"],
                        ["type", "Type"],
                        ["status", "Status"],
                        ["roi", "ROI"],
                        ["price", "Price"],
                      ] as [keyof PropertyListing, string][]).map(([field, label]) => (
                        <th
                          key={field}
                          className={cn("pb-3 px-2 font-medium cursor-pointer hover:text-slate-600 transition-colors select-none", field === "name" && "pr-2 pl-0", field === "price" && "text-right")}
                          onClick={() => handleSort(field)}
                        >
                          {label}<SortIndicator field={field} />
                        </th>
                      ))}
                      <th className="pb-3 pl-2 font-medium w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50/80">
                    {paginatedListings.length > 0 ? paginatedListings.map((listing, idx) => (
                      <tr
                        key={listing.id}
                        className="text-base text-slate-700 hover:bg-slate-50/40 transition-colors group animate-fade-in-up"
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        <td className="py-3 pr-2 flex items-center gap-3 font-medium text-slate-800">
                          <div className="size-10 relative rounded-[10px] overflow-hidden shrink-0 shadow-sm border border-slate-100/50">
                            <Image src={listing.imageUrl} alt={listing.name} fill sizes="40px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                          </div>
                          <button
                            onClick={() => setDrawerProperty(listing)}
                            className="truncate max-w-[150px] tracking-wide text-base hover:text-[#151936] transition-colors text-left"
                          >
                            {listing.name}
                          </button>
                        </td>
                        <td className="py-3 px-2 text-slate-500 font-medium text-base">{listing.location}</td>
                        <td className="py-3 px-2 text-slate-500 font-medium text-base">{listing.type}</td>
                        <td className="py-3 px-2">
                          <span className={cn("text-sm  px-2.5 py-1 rounded-md font-medium tracking-wide whitespace-nowrap", TABLE_STATUS_STYLES[listing.status])}>
                            {listing.status}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-slate-600 mono-data">{listing.roi}</td>
                        <td className="py-3 px-2 text-right text-slate-800 mono-amount">{listing.price}</td>
                        <td className="py-3 pl-2 relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); setRowMenuOpen(rowMenuOpen === listing.id ? null : listing.id); }}
                            className="size-7 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                            aria-label="Row actions"
                          >
                            <IconDotsVertical size={15} />
                          </button>
                          {rowMenuOpen === listing.id && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] z-20 py-1 animate-scale-in">
                              <button onClick={() => { setDrawerProperty(listing); setRowMenuOpen(null); }} className="flex items-center gap-2 w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-left text-base">
                                <IconEye size={14} /> View Details
                              </button>
                              <button onClick={() => { setEditingProperty(listing); setPropertyModalMode("edit"); setPropertyModalOpen(true); setRowMenuOpen(null); }} className="flex items-center gap-2 w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-left text-base">
                                <IconEdit size={14} /> Edit Property
                              </button>
                              <button onClick={() => { setRowMenuOpen(null); }} className="flex items-center gap-2 w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-left text-base">
                                <IconStatusChange size={14} /> Change Status
                              </button>
                              <div className="border-t border-slate-100 my-1" />
                              <button onClick={() => { setDeleteConfirmId(listing.id); setRowMenuOpen(null); }} className="flex items-center gap-2 w-full px-3.5 py-2 text-red-600 hover:bg-red-50 font-medium transition-colors text-left text-base">
                                <IconTrash size={14} /> Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7} className="py-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <IconBuildingSkyscraper size={28} className="text-slate-300" />
                            <p className="text-base text-slate-500 font-medium">No properties match your search.</p>
                            <button onClick={() => setListingSearch("")} className="text-base text-[#151936] font-medium hover:underline">Clear search</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filteredListings.length > ROWS_PER_PAGE && (
                <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
                  <p className="text-sm text-slate-400 font-medium">
                    Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, filteredListings.length)} of {filteredListings.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="size-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="Previous page"
                    >
                      <IconChevronLeft size={16} />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={cn(
                          "size-8 flex items-center justify-center rounded-lg text-base font-medium transition-colors",
                          p === currentPage ? "bg-[#151936] text-white" : "text-slate-500 hover:bg-slate-100"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="size-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-0 mt-2">
              {ACTIVITY_LOGS.map((log, i) => {
                const LogIcon = LOG_ICONS[log.icon];
                return (
                  <div key={log.id} className="flex gap-3.5 relative py-3 animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                    {i < ACTIVITY_LOGS.length - 1 && (
                      <div className="absolute left-[15px] top-[36px] bottom-0 w-px bg-slate-100" />
                    )}
                    <div className="size-[30px] rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 z-10 text-slate-500 shadow-sm">
                      <LogIcon size={14} stroke={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-700 leading-snug font-medium text-base">{log.text}</p>
                      <p className="text-sm text-slate-400 mt-0.5">{log.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === "transactions" && (
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-0 mt-2">
              {ACTIVITY_LOGS.filter((l) => l.type === "payment").length > 0 ? (
                ACTIVITY_LOGS.filter((l) => l.type === "payment").map((log, i) => {
                  const LogIcon = LOG_ICONS[log.icon];
                  return (
                    <div key={log.id} className="flex gap-3.5 py-3 border-b border-slate-50 animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                      <div className="size-[30px] rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-600 shadow-sm">
                        <LogIcon size={14} stroke={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-700 leading-snug font-medium text-base">{log.text}</p>
                        <p className="text-sm text-slate-400 mt-0.5">{log.time}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <IconReceipt size={28} className="text-slate-300 mb-2" />
                  <p className="text-base text-slate-500 font-medium">No recent transactions.</p>
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
        <UnifiedMarketBoard />
      </section>

      {/* ── Modals & Drawers ────────────── */}
      <PropertyFormModal
        open={propertyModalOpen}
        onClose={() => { setPropertyModalOpen(false); setEditingProperty(null); }}
        onSubmit={propertyModalMode === "create" ? handleCreateProperty : handleEditProperty}
        initialData={editingProperty ? {
          name: editingProperty.name,
          location: editingProperty.location,
          type: editingProperty.type,
          status: editingProperty.status,
          price: editingProperty.price,
          roi: editingProperty.roi,
          imageUrl: editingProperty.imageUrl,
        } : undefined}
        mode={propertyModalMode}
      />

      <PropertyDetailDrawer
        open={!!drawerProperty}
        onClose={() => setDrawerProperty(null)}
        property={drawerProperty}
        onEdit={(id) => {
          const prop = listings.find((l) => l.id === id) ?? drawerProperty;
          if (prop) {
            setEditingProperty(prop);
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
        <div className="fixed inset-0 z-10" onClick={() => setRowMenuOpen(null)} aria-hidden="true" />
      )}
    </div>
  );
}
