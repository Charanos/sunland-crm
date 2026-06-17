"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  IconArrowUpRight,
  IconBell,
  IconClockHour4,
  IconTool,
  IconBuildingSkyscraper,
  IconCoin,
  IconTrendingUp,
  IconTrendingDown,
  IconFileCheck,
  IconHomePlus,
  IconWallet,
  IconChartLine,
  IconUsers,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { formatCompactKES } from "@/lib/utils/format";

// Dynamically import client-side chart and helper components with SSR disabled to prevent hydration issues
const SalesChart = dynamic(() => import("./sales-chart"), { ssr: false });
const RadialProgress = dynamic(() => import("./radial-progress"), { ssr: false });
const GrowthWidget = dynamic(() => import("./growth-widget"), { ssr: false });
const UnifiedMarketBoard = dynamic(() => import("./unified-market-board").then(m => ({ default: m.UnifiedMarketBoard })), { ssr: false });
const InternalOperationsBoard = dynamic(() => import("./internal-operations-board").then(m => ({ default: m.InternalOperationsBoard })), { ssr: false });

// ─── Types & Interfaces ───────────────────────────────────────────────────────

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

interface AlertItem {
  id: string;
  title: string;
  body: string;
  tone: "risk" | "warning" | "success" | "info";
  href: string;
}

interface MaintenanceItem {
  id: string;
  title: string;
  property: string;
  priority: "low" | "normal" | "high" | "critical";
  contractor: string;
  daysOpen: number;
}

interface LeaseExpiry {
  id: string;
  tenant: string;
  propertyCode: string;
  property: string;
  expiryDate: string;
  daysRemaining: number;
  rentKes: number;
}

// ─── Structured Data Registry ──────────────────────────────────────────────────

const FEATURED_PROPERTIES = {
  group: {
    name: "Runda Grove Villa",
    location: "Runda, Nairobi",
    price: "KES 21,300,000",
    roi: "12.0% ROI",
    imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80",
    status: "Available" as const,
  },
  commercial: {
    name: "Westlands Tower 4B",
    location: "Westlands, Nairobi",
    price: "KES 720,000 / mo",
    roi: "9.6% Yield",
    imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80",
    status: "Occupied" as const,
  },
  residential: {
    name: "Karen Ridge House",
    location: "Karen, Nairobi",
    price: "KES 62,000,000",
    roi: "8.4% ROI",
    imageUrl: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=80",
    status: "Under Offer" as const,
  },
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

const PROPERTY_LISTINGS: Record<string, PropertyListing[]> = {
  group: [
    { id: "p1", name: "Runda Grove Villa", location: "Runda, Nairobi", type: "Premium Estate", status: "Available", roi: "12.0%", price: "KES 21.3M", imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "p2", name: "Westlands Tower 4B", location: "Westlands, Nairobi", type: "Office Suite", status: "Occupied", roi: "9.6%", price: "KES 720K/mo", imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "p3", name: "Karen Ridge House", location: "Karen, Nairobi", type: "Luxury Villa", status: "Under Offer", roi: "8.4%", price: "KES 62M", imageUrl: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "p4", name: "Upper Hill Plaza", location: "Upper Hill, Nairobi", type: "Office Floor", status: "Available", roi: "11.2%", price: "KES 120M", imageUrl: "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "p5", name: "Kilimani Heights", location: "Kilimani, Nairobi", type: "Apartment", status: "Available", roi: "6.8%", price: "KES 14M", imageUrl: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "p6", name: "Lavington Gardens", location: "Lavington, Nairobi", type: "Townhouse", status: "Sold", roi: "5.0%", price: "KES 48M", imageUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=120&h=80&q=80" },
    { id: "p7", name: "Riverside Haven", location: "Riverside, Nairobi", type: "Executive Studio", status: "Available", roi: "4.0%", price: "KES 8.5M", imageUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=120&h=80&q=80" },
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

const STATS_TONES = {
  Available: "bg-[#e8f7ef] text-[#16623b] border-[#d3f0e0]",
  Sold: "bg-[#ffeded] text-[#8a1f1f] border-[#fcd5d5]",
  "Under Offer": "bg-[#fff4cb] text-[#704800] border-[#faeab1]",
  Occupied: "bg-[#ecf0ff] text-[#203c9d] border-[#d7e0ff]",
};

const STATUS_DARK_TONES = {
  Available: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Sold: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "Under Offer": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  Occupied: "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

const ALERTS: Record<string, AlertItem[]> = {
  group: [
    { id: "a1", tone: "warning", title: "Lease Expiry Window", body: "3 leases expire within 90 days and need renewal action.", href: "/admin/leases" },
    { id: "a2", tone: "risk", title: "Arrears Triggered", body: "KES 1.8M arrears recorded across commercial properties.", href: "/admin/finance" },
    { id: "a3", tone: "success", title: "Payment Verified", body: "KES 720K rent payment cleared for Westlands Tower.", href: "/admin/finance" },
  ],
  commercial: [
    { id: "ca1", tone: "warning", title: "Maintenance Past Due", body: "Water system check in Westlands Tower is past threshold.", href: "/admin/maintenance" },
    { id: "ca2", tone: "success", title: "Lease Finalized", body: "Upper Hill plaza floor 3 lease successfully signed.", href: "/admin/leases" },
  ],
  residential: [
    { id: "ra1", tone: "risk", title: "Deposit Dispute", body: "Runda tenant flagged formal dispute on deposit refund.", href: "/admin/finance" },
    { id: "ra2", tone: "info", title: "Viewing Scheduled", body: "Amina scheduled 4 client viewings for Karen Ridge.", href: "/admin/pipeline" },
  ],
};

const MAINTENANCE_QUEUE: Record<string, MaintenanceItem[]> = {
  group: [
    { id: "m1", title: "Water pressure issue", property: "Westlands Tower 4B", priority: "critical", contractor: "Apex Plumbing", daysOpen: 9 },
    { id: "m2", title: "Generator overhaul", property: "Karen Ridge House", priority: "high", contractor: "GridWorks", daysOpen: 4 },
    { id: "m3", title: "Elevator safety audit", property: "Kilimani Residences", priority: "normal", contractor: "Kone Elevators", daysOpen: 2 },
  ],
  commercial: [
    { id: "mc1", title: "Water pressure issue", property: "Westlands Tower 4B", priority: "critical", contractor: "Apex Plumbing", daysOpen: 9 },
    { id: "mc2", title: "HVAC maintenance", property: "Upper Hill Plaza", priority: "normal", contractor: "ClimateForce", daysOpen: 3 },
  ],
  residential: [
    { id: "mr1", title: "Pool filtration service", property: "Karen Ridge House", priority: "high", contractor: "PoolCraft", daysOpen: 4 },
    { id: "mr2", title: "Plumbing repair", property: "Kilimani Heights", priority: "low", contractor: "Apex Plumbing", daysOpen: 1 },
  ],
};

const LEASE_EXPIRIES: Record<string, LeaseExpiry[]> = {
  group: [
    { id: "l1", tenant: "Malaika Foods Ltd", propertyCode: "WL-4B", property: "Westlands Tower", expiryDate: "2026-07-15", daysRemaining: 28, rentKes: 720000 },
    { id: "l2", tenant: "Ruth Wanjiku", propertyCode: "KIL-A12", property: "Kilimani Heights", expiryDate: "2026-08-02", daysRemaining: 46, rentKes: 208000 },
  ],
  commercial: [
    { id: "lc1", tenant: "Malaika Foods Ltd", propertyCode: "WL-4B", property: "Westlands Tower", expiryDate: "2026-07-15", daysRemaining: 28, rentKes: 720000 },
  ],
  residential: [
    { id: "lr1", tenant: "Ruth Wanjiku", propertyCode: "KIL-A12", property: "Kilimani Heights", expiryDate: "2026-08-02", daysRemaining: 46, rentKes: 208000 },
  ],
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function DashboardOverview({ entityId = "group" }: { entityId?: string }) {
  const [activeTab, setActiveTab] = useState<"listings" | "history">("listings");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Normalizing context parameter
  const context = (entityId === "commercial" || entityId === "residential") ? entityId : "group";

  // Context-specific metrics (scaled realistically based on context)
  const isComm = context === "commercial";
  const isRes = context === "residential";

  const metrics = {
    activeListings: isComm ? "96" : isRes ? "152" : "248",
    activeTrend: isComm ? "+12% this month" : isRes ? "+22% this month" : "+18% this month",
    revenueMtd: isComm ? "KES 16.7M" : isRes ? "KES 26.1M" : "KES 42.8M",
    revenueTrend: isComm ? "+8.2% growth" : isRes ? "+14.8% growth" : "+12.4% growth",
    closedDeals: isComm ? "37" : isRes ? "59" : "96",
    closedTrend: isComm ? "12% increase" : isRes ? "16% increase" : "12% increase",
    newDeals: isComm ? "483" : isRes ? "757" : "1,240",
    newDealsTrend: isComm ? "18% conversion" : isRes ? "25% conversion" : "22% conversion",
    radialVal: isComm ? "4,847" : isRes ? "7,583" : "12,430",
    radialPct: isComm ? 86 : isRes ? 95 : 93,
    radialSub: isComm ? "commercial leases added" : isRes ? "residential leases added" : "monthly added units",
  };

  const featured = FEATURED_PROPERTIES[context];
  const chartData = CHART_DATA[context];
  const tableListings = PROPERTY_LISTINGS[context];
  const alertsList = ALERTS[context] || [];
  const maintenanceList = MAINTENANCE_QUEUE[context] || [];
  const expiriesList = LEASE_EXPIRIES[context] || [];

  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-3 transition-opacity duration-300">
      {/* ── Hero Command Title ──────────────────────────────── */}
      <section className="flex flex-col gap-1 border-b border-slate-200/60 pb-3">
        <div className="flex items-center gap-2.5">
          <Badge tone="primary" className="font-medium tracking-wide">
            {isComm ? "Commercial Operations" : isRes ? "Residential Operations" : "Consolidated Group"}
          </Badge>
          <span className="text-[12.5px] font-mono text-slate-500 font-medium">System Status: Live Operations</span>
        </div>
        <h1 className="title-serif text-slate-900 mt-2">
          {isComm ? "Commercial Portfolio Command" : isRes ? "Residential Portfolio Command" : "Real Estate Management Command"}
        </h1>
        <p className="text-[13.5px] text-slate-500 max-w-3xl leading-relaxed mt-1">
          Monitor transactional metrics, manage dynamic properties listings, evaluate sales analytics
          pipelines, and coordinate operational tasks from this unified command center.
        </p>
      </section>

      {/* ── Grid Row 1: Key Performance Metrics ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 my-10">
        {/* Col 1: Active Listing + Revenue (Stacked) */}
        <div className="flex flex-col gap-3">
          <div className="relative p-5 rounded-[20px] bg-[#e1f3f6] h-[155px] flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center gap-2">
              <div className="size-[22px] rounded-full bg-[#15464e] flex items-center justify-center text-white">
                <IconBuildingSkyscraper size={12} stroke={2.5} />
              </div>
              <span className="text-[13.5px] font-normal text-[#2e626a] tracking-wide">Active Listings</span>
            </div>

            <div className="flex items-end justify-between mt-auto mb-3">
              <span className="text-[32px] font-medium text-[#15464e] tracking-tight font-mono leading-none">{metrics.activeListings}</span>
              <span className="text-[11px] font-medium text-[#2e626a] mb-0.5">{metrics.activeTrend.split(' ')[0]}</span>
            </div>

            <div className="h-[4px] bg-[#c3e3e8] rounded-full overflow-hidden w-full">
              <div className="h-full bg-[#3f919d] rounded-full w-[75%]" />
            </div>
          </div>

          <div className="relative p-5 rounded-[20px] bg-[#e6f4ea] h-[155px] flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center gap-2">
              <div className="size-[22px] rounded-full bg-[#1b431e] flex items-center justify-center text-white">
                <IconCoin size={13} stroke={2.5} />
              </div>
              <span className="text-[13.5px] font-normal text-[#336336] tracking-wide">Total Revenue</span>
            </div>

            <div className="flex items-end justify-between mt-auto mb-3">
              <span className="text-[32px] font-medium text-[#1b431e] tracking-tight font-mono leading-none">{metrics.revenueMtd}</span>
              <span className="text-[11px] font-medium text-[#336336] mb-0.5">{metrics.revenueTrend.split(' ')[0]}</span>
            </div>

            <div className="h-[4px] bg-[#c6e0c7] rounded-full overflow-hidden w-full">
              <div className="h-full bg-[#48954b] rounded-full w-[82%]" />
            </div>
          </div>
        </div>

        {/* Col 2-3: Featured Property (Spans 2 columns, Rectangular layout) */}
        <Card className="xl:col-span-2 h-[326px] bg-slate-900 border-none hover:shadow-md transition-all overflow-hidden relative group flex flex-col justify-between">
          {/* Background image */}
          <div className="absolute inset-0 z-0">
            <Image
              src={featured.imageUrl}
              alt={featured.name}
              fill
              sizes="(max-width: 1024px) 100vw, 600px"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Soft dark overlay to ensure readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/45 to-slate-950/30" />
          </div>

          {/* Top Info Overlay */}
          <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between z-10">
            <span className="backdrop-blur-md bg-white/10 text-white border border-white/20 text-[11px] px-2.5 py-1 rounded-md tracking-wider uppercase font-medium">
              Featured Property
            </span>
            <Link
              href="/admin/properties"
              className="backdrop-blur-md bg-white/10 text-white hover:bg-white/20 border border-white/20 text-[11px] px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-all"
            >
              View All <IconArrowUpRight size={13} />
            </Link>
          </div>

          {/* Bottom Info Overlay */}
          <div className="absolute bottom-0 inset-x-0 p-5 flex flex-col justify-end text-white z-10">
            <div>
              <p className="font-mono text-[var(--primary)] text-2xl sm:text-[26px] tracking-tight leading-none font-medium">
                {featured.price}
              </p>
              <h3 className="text-lg font-medium text-white mt-1.5 leading-snug">
                {featured.name}
              </h3>
              <p className="text-[11.5px] text-slate-300 font-medium mt-0.5 uppercase tracking-wide">
                {featured.location}
              </p>
            </div>

            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/10">
              <span className={cn(
                "text-[10px] px-2.5 py-0.5 rounded-full border font-medium uppercase tracking-wider",
                STATUS_DARK_TONES[featured.status]
              )}>
                {featured.status}
              </span>
              <span className="text-sm font-mono text-slate-300 font-medium">
                {featured.roi}
              </span>
              <Link
                href="/admin/properties"
                className="focus-ring ml-auto inline-flex h-8.5 items-center justify-center rounded-lg bg-white text-slate-900 px-4 text-sm font-medium transition hover:bg-slate-100"
              >
                More Details
              </Link>
            </div>
          </div>
        </Card>

        {/* Col 4: Closed Deals + New Deals (Stacked) */}
        {/* Col 4: Closed Deals + New Deals (Stacked) */}
        <div className="flex flex-col gap-3">
          <div className="relative p-5 rounded-[20px] bg-[#fcf0e4] h-[155px] flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center gap-2">
              <div className="size-[22px] rounded-full bg-[#5e2b17] flex items-center justify-center text-white">
                <IconFileCheck size={13} stroke={2.5} />
              </div>
              <span className="text-[13.5px] font-normal text-[#824429] tracking-wide">Closed Deals</span>
            </div>

            <div className="flex items-end justify-between mt-auto mb-3">
              <span className="text-[32px] font-medium text-[#5e2b17] tracking-tight font-mono leading-none">{metrics.closedDeals}</span>
              <span className="text-[11px] font-medium text-[#824429] mb-0.5">{metrics.closedTrend.split(' ')[0]}</span>
            </div>

            <div className="h-[4px] bg-[#f2d8c9] rounded-full overflow-hidden w-full">
              <div className="h-full bg-[#c96f45] rounded-full w-[60%]" />
            </div>
          </div>

          <div className="relative p-5 rounded-[20px] bg-[#eef2f6] h-[155px] flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center gap-2">
              <div className="size-[22px] rounded-full bg-[#24354a] flex items-center justify-center text-white">
                <IconHomePlus size={13} stroke={2.5} />
              </div>
              <span className="text-[13.5px] font-normal text-[#415671] tracking-wide">New Deals</span>
            </div>

            <div className="flex items-end justify-between mt-auto mb-3">
              <span className="text-[32px] font-medium text-[#24354a] tracking-tight font-mono leading-none">{metrics.newDeals}</span>
              <span className="text-[11px] font-medium text-[#415671] mb-0.5">{metrics.newDealsTrend.split(' ')[0]}</span>
            </div>

            <div className="h-[4px] bg-[#d2dde8] rounded-full overflow-hidden w-full">
              <div className="h-full bg-[#5a7c9f] rounded-full w-[45%]" />
            </div>
          </div>
        </div>

        {/* Col 5: New Units Added Radial Meter (Tall card) */}
        <Card className="p-5 flex flex-col justify-between items-center h-[326px] bg-white border border-slate-100 hover:shadow-md transition-all">
          <p className="text-[13px] font-medium text-slate-500 uppercase tracking-wider">New Units added</p>
          {mounted ? (
            <RadialProgress
              percentage={metrics.radialPct}
              valueLabel={metrics.radialVal}
              subtitle={metrics.radialSub}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-sm text-slate-400 font-medium">Loading Meter...</span>
            </div>
          )}
        </Card>
      </section>


      {/* ── Grid Row 6: Internal Structure & Executive Scheduler ─────────── */}
      <section className="w-full">
        <InternalOperationsBoard />
      </section>

      {/* ── Grid Row 2: Revenue Chart (Left) + Stats Column (Right) ─ */}
      <div className="pt-6 border-t border-slate-200/60 my-4">
        <h2 className="title-serif text-slate-900 text-[22px]">Operational Analytics & Insights</h2>
        <p className="text-[12px] text-slate-500 font-medium tracking-wide mt-1">Deep-dive into revenue trends and core performance metrics.</p>
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
        {/* Revenue Analytics Chart */}
        <div className="p-6 xl:col-span-8 flex flex-col justify-between bg-white rounded-[20px] border border-slate-100 shadow-sm hover:shadow-md transition-all min-h-[420px]">
          <div>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[18px] text-slate-800 font-medium tracking-tight">Revenue</h2>
              <div className="flex items-center gap-1 bg-slate-50/80 p-1 rounded-lg">
                <button className="text-sm px-3 py-1.5 rounded-md bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-slate-800 font-medium transition-all tracking-wide">All</button>
                <button className="text-sm px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-700 font-medium transition-all tracking-wide">Income</button>
                <button className="text-sm px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-700 font-medium transition-all tracking-wide">Expenses</button>
                <button className="text-sm px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-700 font-medium transition-all tracking-wide">Profit</button>
              </div>
            </div>

            <div className="flex items-center gap-10 mb-6">
              <div className="flex items-start gap-3">
                <div className="size-[34px] rounded-[10px] bg-[#e1f3f6] flex items-center justify-center text-[#15464e]">
                  <IconCoin size={18} stroke={2} />
                </div>
                <div>
                  <p className="text-[12.5px] text-slate-500 font-medium mb-0.5">Income</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[22px] text-slate-800 font-medium font-mono leading-none tracking-tight">$26,000</span>
                    <span className="text-[11px] font-medium text-emerald-600 flex items-center">10% <IconTrendingUp size={12} className="ml-0.5" /></span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="size-[34px] rounded-[10px] bg-[#fcf0e4] flex items-center justify-center text-[#c96f45]">
                  <IconWallet size={18} stroke={2} />
                </div>
                <div>
                  <p className="text-[12.5px] text-slate-500 font-medium mb-0.5">Expenses</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[22px] text-slate-800 font-medium font-mono leading-none tracking-tight">$18,000</span>
                    <span className="text-[11px] font-medium text-rose-600 flex items-center">10% <IconTrendingDown size={12} className="ml-0.5" /></span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="size-[34px] rounded-[10px] bg-[#eef2f6] flex items-center justify-center text-[#5a7c9f]">
                  <IconChartLine size={18} stroke={2} />
                </div>
                <div>
                  <p className="text-[12.5px] text-slate-500 font-medium mb-0.5">Profit</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[22px] text-slate-800 font-medium font-mono leading-none tracking-tight">$8,000</span>
                    <span className="text-[11px] font-medium text-rose-600 flex items-center">3% <IconTrendingDown size={12} className="ml-0.5" /></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[200px] flex items-end">
            {mounted ? (
              <SalesChart data={chartData} />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-sm text-slate-400 font-medium">
                Loading analytics data...
              </div>
            )}
          </div>
        </div>

        {/* Stats Column (Right) */}
        <div className="xl:col-span-4 flex flex-col gap-3">
          {/* Sales Statistic */}
          <div className="p-6 bg-white rounded-[20px] shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all h-[132px]">
            <h3 className="text-[14px] text-slate-800 font-medium tracking-wide">Sales Statistic</h3>
            <div className="flex items-end justify-between mt-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
                  <IconCoin size={20} stroke={1.5} />
                </div>
                <div>
                  <p className="text-[11.5px] text-slate-400 font-medium mb-0.5">Total Profit</p>
                  <p className="text-[22px] text-slate-800 font-medium font-mono leading-none tracking-tight">$24.9k</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[11.5px] text-slate-400 font-medium">Visitors</p>
                  <span className="text-[11px] font-medium text-emerald-600 flex items-center bg-emerald-50 px-1.5 rounded">$24k <IconTrendingUp size={10} className="ml-0.5" /></span>
                </div>
                <div className="w-[100px] h-[3px] bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-[65%]" />
                </div>
              </div>
            </div>
          </div>

          {/* Visit Statistic */}
          <div className="p-6 bg-white rounded-[20px] shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all h-[132px]">
            <h3 className="text-[14px] text-slate-800 font-medium tracking-wide">Visit Statistic</h3>
            <div className="flex items-end justify-between mt-2">
              <div className="flex-1 max-w-[120px]">
                {/* Mock mini line chart */}
                <div className="h-10 w-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-slate-400 font-medium">Sat</span>
                  <span className="text-[10px] text-slate-400 font-medium">Sun</span>
                  <span className="text-[10px] text-slate-400 font-medium">Mon</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11.5px] text-slate-400 font-medium mb-0.5">Rate</p>
                <p className="text-[20px] text-[#5a7c9f] font-medium font-mono leading-none tracking-tight bg-[#eef2f6] px-2 py-1 rounded-md">32.43%</p>
              </div>
            </div>
          </div>

          {/* New Visitors */}
          <div className="p-6 bg-white rounded-[20px] shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all h-[132px]">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] text-slate-800 font-medium tracking-wide">New Visitors</h3>
              <span className="text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">$2.2k</span>
            </div>
            <div className="flex items-end justify-between mt-2">
              <div>
                <p className="text-[11px] text-slate-400 font-medium max-w-[100px] leading-snug mb-2">48% new visitors this week.</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[18px] text-slate-800 font-medium font-mono leading-none tracking-tight">12,480</span>
                  <span className="text-[11px] font-medium text-emerald-600 flex items-center bg-emerald-50 px-1.5 rounded"><IconTrendingUp size={10} className="mr-0.5" /> 28</span>
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
        </div>
      </section>

      {/* ── Grid Row 3: Listing Board (Table) + Growth Widget ─ */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch mt-1">

        {/* Listing Board / Active Property Listings */}
        <div className="p-6 xl:col-span-8 flex flex-col justify-between bg-white rounded-[20px] border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden min-h-[380px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] text-slate-800 font-medium tracking-wide">Listing Board</h2>
              <div className="flex items-center gap-1 bg-slate-50/80 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab("listings")}
                  className={cn(
                    "text-sm px-3 py-1.5 rounded-md transition-all font-medium tracking-wide",
                    activeTab === "listings" ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-slate-800" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Listings
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={cn(
                    "text-sm px-3 py-1.5 rounded-md transition-all font-medium tracking-wide",
                    activeTab === "history" ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-slate-800" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Recent Logs
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto [scrollbar-width:thin] mt-2">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-100/60 text-[11px] font-medium text-slate-400 uppercase tracking-widest">
                  <th className="pb-3 pr-2 font-medium">Property Name</th>
                  <th className="pb-3 px-2 font-medium">Location</th>
                  <th className="pb-3 px-2 font-medium">Type</th>
                  <th className="pb-3 px-2 font-medium">Status</th>
                  <th className="pb-3 px-2 font-medium">ROI</th>
                  <th className="pb-3 pl-2 font-medium text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50/80">
                {tableListings.map((listing) => (
                  <tr key={listing.id} className="text-[13px] text-slate-700 hover:bg-slate-50/40 transition-colors group">
                    <td className="py-3 pr-2 flex items-center gap-3 font-medium text-slate-800">
                      <div className="size-10 relative rounded-[10px] overflow-hidden shrink-0 shadow-sm border border-slate-100/50">
                        <Image
                          src={listing.imageUrl}
                          alt={listing.name}
                          fill
                          sizes="40px"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <span className="truncate max-w-[150px] tracking-wide text-[13px]">{listing.name}</span>
                    </td>
                    <td className="py-3 px-2 text-slate-500 font-medium text-[12.5px]">{listing.location}</td>
                    <td className="py-3 px-2 text-slate-500 font-medium text-[12.5px]">{listing.type}</td>
                    <td className="py-3 px-2">
                      <span className={cn(
                        "text-[10px] px-2.5 py-1 rounded-md font-medium tracking-wide whitespace-nowrap",
                        listing.status === "Available" ? "bg-[#e6f4ea] text-[#1b431e]" :
                          listing.status === "Occupied" ? "bg-[#eef2f6] text-[#24354a]" :
                            listing.status === "Under Offer" ? "bg-[#fcf0e4] text-[#5e2b17]" : "bg-slate-100 text-slate-600"
                      )}>
                        {listing.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-mono font-medium text-[12.5px] text-slate-600">{listing.roi}</td>
                    <td className="py-3 pl-2 font-mono text-right text-slate-800 font-medium text-[13px]">{listing.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Growth Progress Rails sidebar (Right column) */}
        <div className="p-6 xl:col-span-4 bg-white rounded-[20px] border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <GrowthWidget entityId={context} />
        </div>
      </section>

      {/* ── Grid Row 4: Unified Property & Market Insights ──────────────── */}
      <section className="w-full">
        <UnifiedMarketBoard />
      </section>

    </div>
  );
}
