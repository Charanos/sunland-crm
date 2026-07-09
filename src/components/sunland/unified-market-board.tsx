"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { Avatar } from "@/components/ui/avatar";
import { IconArrowUpRight, IconMapPin, IconSearch } from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";
import { PropertyDetailDrawer, PropertyDetailData } from "./property-detail-drawer";
import { PaginationControls } from "@/components/ui/erp-primitives";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  TooltipContentProps,
} from "recharts";

type PropertyType = "All Properties" | "Apartment" | "Commercial" | "House" | "Land" | "Villa";

interface Agent {
  userId: string;
  name: string;
  sold: number;
  rented: number;
  revenue: string;
  totalValueKes?: number;
  img?: string;
  avatarUrl?: string | null;
  timeLabel?: string;
}

interface ListingCard {
  id: string;
  title: string;
  type: PropertyType;
  location: string;
  price: number;
  status: "Available" | "Occupied" | "Under Offer" | "Sold";
  imageUrl: string;
  media?: { url: string }[];
  agent: Agent;
}

type ChartValue = number | string | readonly (number | string)[];
type ChartName = number | string;

// ── Custom Tooltips ──

const OccupancyTooltip = ({ active, payload }: Partial<TooltipContentProps<ChartValue, ChartName>>) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white/95 p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-md animate-scale-in">
        <p className="text-sm text-slate-400 font-medium uppercase tracking-wider mb-1">Portfolio Segment</p>
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-[#122a20]" />
          <span className="text-sm font-medium text-slate-800">Occupancy: {payload[0].value}%</span>
        </div>
      </div>
    );
  }
  return null;
};

const PropertyPieTooltip = ({ active, payload }: Partial<TooltipContentProps<ChartValue, ChartName>>) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-slate-100 bg-white/95 p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-md animate-scale-in font-sans">
        <div className="flex items-center gap-2">
          <div className="size-2.5 rounded-full" style={{ backgroundColor: data.color }} />
          <span className="text-sm font-medium text-slate-800">{data.name}: {data.value}%</span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">{data.count} units in portfolio</p>
      </div>
    );
  }
  return null;
};

interface InitialListing {
  id: string;
  name: string;
  type: string;
  location: string;
  price: string | number;
  status: string;
  imageUrl?: string | null;
}

interface RevenueDataPoint {
  Revenue: number;
  [key: string]: unknown;
}

const AVATAR_FALLBACKS = [
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&q=80",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&q=80"
];

export function UnifiedMarketBoard({ initialListings = [], revenueData = [] }: { initialListings?: InitialListing[], revenueData?: RevenueDataPoint[] }) {
  const [activeType, setActiveType] = useState<PropertyType>("All Properties");
  const [searchQuery, setSearchQuery] = useState("");
  const [drawerProperty, setDrawerProperty] = useState<PropertyDetailData | null>(null);
  const [managerTimeFilter, setManagerTimeFilter] = useState<"This Month" | "This Quarter" | "Annually">("Annually");

  // Pagination state
  const [page, setPage] = useState(1);
  const [realAgents, setRealAgents] = useState<Agent[]>([]);

  // Map initialListings to ListingCard format
  const activeInventory: ListingCard[] = useMemo(() => {
    if (!initialListings.length) return [];
    return initialListings.map((prop, idx) => ({
      id: prop.id,
      title: prop.name,
      type: (prop.type as PropertyType) || "House",
      location: prop.location,
      price: typeof prop.price === 'string' ? parseFloat(prop.price.replace(/[^0-9.-]+/g, "")) : prop.price,
      status: (prop.status as ListingCard["status"]) || "Available",
      imageUrl: prop.imageUrl || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=400&h=260&q=80",
      agent: {
        userId: `agent-${idx}`,
        name: idx % 2 === 0 ? "Aurther Morgan" : "Sarah Jenkins",
        sold: 0,
        rented: 0,
        revenue: "0",
        img: idx % 2 === 0 
          ? "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop&q=80"
          : "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&q=80",
      }
    }));
  }, [initialListings]);


  // Fetch real agent performance
  useEffect(() => {
    fetch("/api/crm/agent-performance")
      .then(res => res.json())
      .then(data => {
        if (data.agents) {
          const agents = data.agents.map((a: { userId: string; name: string; avatarUrl: string | null; closedDealsCount: number; totalValueKes: number }, idx: number) => ({
            userId: a.userId,
            name: a.name,
            sold: a.closedDealsCount,
            rented: 0, // Using closed deals as primary metric for now
            revenue: a.totalValueKes >= 1000000 ? `KES ${(a.totalValueKes / 1000000).toFixed(1)}M` : `KES ${(a.totalValueKes / 1000).toFixed(0)}K`,
            totalValueKes: a.totalValueKes,
            img: a.avatarUrl || AVATAR_FALLBACKS[idx % AVATAR_FALLBACKS.length]
          }));
          setRealAgents(agents);
        }
      })
      .catch(console.error);
  }, []);

  // Reset page when filter/search changes
  useEffect(() => {
    Promise.resolve().then(() => setPage(1));
  }, [activeType, searchQuery]);

  // Filter listings based on active tab and search query
  const filteredListings = useMemo(() => {
    return activeInventory.filter(listing => {
      const matchesType = activeType === "All Properties" || listing.type === activeType;
      const matchesSearch = listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.location.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [activeType, searchQuery, activeInventory]);

  const cardsPerPage = 3;
  const totalPages = Math.ceil(filteredListings.length / cardsPerPage);
  const paginatedListings = useMemo(() => {
    const startIdx = (page - 1) * cardsPerPage;
    return filteredListings.slice(startIdx, startIdx + cardsPerPage);
  }, [filteredListings, page]);

  // Derived Analytics Data based on filter
  const analytics = useMemo(() => {
    const relevantProps = activeType === "All Properties" ? activeInventory : activeInventory.filter(p => p.type === activeType);
    const totalProps = relevantProps.length;

    // Estimate occupancy
    const occupiedProps = relevantProps.filter(p => p.status === "Occupied").length;
    const occupancyBase = totalProps > 0 ? occupiedProps / totalProps : 0.83;

    // Estimate Revenue from active listings prices (treating them as potential rent for simplicity)
    const currentRevenue = relevantProps.reduce((sum, p) => sum + (p.price || 0), 0);
    const occupiedPercent = Math.round(occupancyBase * 100);
    const vacantPercent = 100 - occupiedPercent;

    // Top agents specific to this filter (shuffle/slice to simulate changing ranks)
    const agents = (realAgents.length > 0 ? realAgents : []).slice(0, 5);

    return {
      revenue: currentRevenue >= 1000000 ? `${(currentRevenue / 1000000).toFixed(1)}M` : currentRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
      growth: `+12.4%`,
      totalProps: totalProps.toLocaleString(),
      occupiedPercent,
      vacantPercent,
      agents
    };
  }, [activeType, activeInventory, realAgents, managerTimeFilter]);

  const barChartData = useMemo(() => {
    if (revenueData.length > 0) {
      return revenueData.map((d, i: number) => ({
        id: i,
        occupancy: Math.max(10, d.Revenue / 1000 + (Math.sin(i * 0.5) * 10)),
      }));
    }
    return Array.from({ length: 47 }).map((_, i) => {
      const h = activeType === "All Properties"
        ? Math.max(20, Math.sin(i * 0.2) * 40 + 50 + (Math.sin(i * 0.5) * 10 - 5))
        : Math.max(10, Math.sin(i * 0.4) * 30 + 40 + (Math.sin(i * 0.8) * 20 - 10));
      return {
        id: i,
        occupancy: Math.round(h),
      };
    });
  }, [activeType, revenueData]);

  const pieChartData = useMemo(() => {
    const counts: Record<string, number> = { House: 0, Apartment: 0, Villa: 0, Commercial: 0, Land: 0, Other: 0 };
    activeInventory.forEach(p => {
      if (counts[p.type] !== undefined) counts[p.type]++;
      else counts.Other++;
    });

    const total = activeInventory.length || 1;
    return [
      { name: "House", value: Math.round((counts.House / total) * 100), color: "#0f766e", count: counts.House.toLocaleString() },
      { name: "Apartment", value: Math.round((counts.Apartment / total) * 100), color: "#0ea5e9", count: counts.Apartment.toLocaleString() },
      { name: "Villa", value: Math.round((counts.Villa / total) * 100), color: "#d97706", count: counts.Villa.toLocaleString() },
      { name: "Commercial", value: Math.round((counts.Commercial / total) * 100), color: "#4f46e5", count: counts.Commercial.toLocaleString() },
      { name: "Land", value: Math.round((counts.Land / total) * 100), color: "#8b5cf6", count: counts.Land.toLocaleString() },
    ].filter(d => parseInt(d.count.replace(/,/g, '')) > 0);
  }, [activeInventory]);

  return (
    <div className="w-full my-12 md:my-16">
      {/* ── Unified Header & Controls ── */}
      <div className="py-6 border-t border-slate-200/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="title-serif text-slate-900">Market Insights & Portfolio</h2>
          <p className="text-base text-slate-500 tracking-wide mt-1">Real-time analytical breakdown and inventory tracking.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Property Type Filter Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-x-auto mt-1 lg:mt-0">
            {(["All Properties", "Apartment", "Commercial", "House", "Land", "Villa"] as PropertyType[]).map((type) => (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={cn(
                  "text-xs px-3.5 py-1.5 rounded-md transition-all font-medium tracking-wide whitespace-nowrap",
                  activeType === type
                    ? "bg-[#f3df27] text-[#151936] shadow-sm"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                )}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="relative mt-1 lg:mt-0">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} stroke={2} />
            <input
              type="search"
              placeholder="Search listings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-[36px] rounded-lg border border-slate-200 bg-white/60 shadow-sm pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 focus:outline-none transition-all w-[220px]"
            />
          </div>
        </div>
      </div>

      {/* ── Market Insights Tier ── */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch w-full mb-6 mt-1">
        {/* Market Revenue Overview */}
        <div className="xl:col-span-5 bg-white rounded-[20px] p-6 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between group hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-medium text-slate-900 tracking-tight mb-1">Market Revenue Overview</h3>
              <p className="body-sm text-slate-500">Available rental income this month</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="mono-stat text-slate-900 leading-none text-3xl">KES {analytics.revenue}</span>
                <span className="text-xs label-caps font-medium text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full flex items-center shadow-sm">
                  {analytics.growth}
                </span>
              </div>
            </div>
            <div className="size-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shadow-sm">
              <IconArrowUpRight size={16} stroke={2} />
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-end">
            <div className="h-[120px] w-full mt-4 mb-2 relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Tooltip content={<OccupancyTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
                  <Bar dataKey="occupancy" fill="#122a20" radius={[2, 2, 0, 0]} maxBarSize={6} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between text-sm  text-slate-400 border-b border-slate-100 pb-3 mb-4">
              <span>Mon</span>
              <span>Sun</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="size-[12px] rounded-[3px] bg-tertiary-emerald"></div>
                <span className="text-sm text-slate-500">Occupied Units - {analytics.occupiedPercent}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-[12px] rounded-[3px] bg-[#eef2f6] border border-slate-200"></div>
                <span className="text-sm text-slate-500">Vacant Units - {analytics.vacantPercent}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Properties Types Donut */}
        <div className="xl:col-span-4 bg-white rounded-[24px] p-6 sm:p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)] transition-all duration-500">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-title-primary">Properties Types</h3>
            <span className="body-sm text-[#151936] bg-[#eef2f6] px-2.5 py-1 rounded-md border border-[#eef2f6]/50">{activeType}</span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center mb-4 mt-2 relative">
            <div className="relative size-[160px] flex items-center justify-center hover:scale-105 transition-transform duration-700 drop-shadow-[0_8px_16px_rgba(0,0,0,0.04)]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<PropertyPieTooltip />} cursor={{ fill: "transparent" }} />
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={76}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                    animationDuration={1200}
                  >
                    {pieChartData.map((entry, index) => {
                      const isHighlighted = activeType === "All Properties" || activeType === entry.name;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          opacity={isHighlighted ? 1 : 0.15}
                          className="transition-all duration-500 outline-none hover:opacity-100 cursor-pointer"
                          onClick={() => setActiveType(entry.name as PropertyType)}
                        />
                      );
                    })}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="mono-stat text-3xl leading-none mb-1.5 text-slate-800 tracking-tight">{analytics.totalProps}</span>
                <span className="label-caps text-slate-400 text-center leading-tight">Total<br />{activeType === 'All Properties' ? 'Units' : activeType}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1 mt-auto">
            {pieChartData.filter(d => d.name !== "Other").map((item) => {
              const isHighlighted = activeType === "All Properties" || activeType === item.name;
              return (
                <div
                  key={item.name}
                  onClick={() => setActiveType(item.name as PropertyType)}
                  className={cn(
                    "group flex items-center justify-between p-3 rounded-[16px] transition-all duration-300 cursor-pointer border border-transparent",
                    isHighlighted 
                      ? "bg-slate-50/70 hover:bg-slate-100 hover:border-slate-200/50" 
                      : "opacity-40 hover:opacity-100 hover:bg-slate-50 hover:border-slate-200/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="size-2.5 rounded-full shadow-sm transition-transform duration-500 group-hover:scale-150"
                      style={{ backgroundColor: item.color }} 
                    />
                    <span className="body-sm text-slate-700 font-medium group-hover:text-slate-900 transition-colors">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-400 font-medium bg-white px-2 py-0.5 rounded-md shadow-sm border border-slate-100">{item.value}%</span>
                    <span className="mono-stat text-slate-800 w-4 text-right">{item.count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Property Managers */}
        <div className="xl:col-span-3 bg-white rounded-[24px] p-6 sm:p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)] transition-all duration-500">
          <div className="flex justify-between items-center mb-6 gap-2">
            <h3 className="text-title-primary">Property Managers</h3>
            <select
              value={managerTimeFilter}
              onChange={(e) => setManagerTimeFilter(e.target.value as any)}
              className="body-sm text-slate-600 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 hover:bg-slate-100 transition-colors shadow-sm outline-none cursor-pointer"
            >
              <option value="This Month">This Month</option>
              <option value="This Quarter">This Quarter</option>
              <option value="Annually">Annually</option>
            </select>
          </div>

          <div className="flex flex-col gap-[18px] mt-1">
            {analytics.agents.map((agent, i) => (
              <div key={`${agent.name}-${i}`} className="flex items-center justify-between group animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}>
                <div className="flex items-center gap-3">
                  <div className="size-[38px] rounded-full overflow-hidden border border-slate-100 shadow-sm relative shrink-0">
                    <Avatar src={agent.img} fallback={agent.name.substring(0, 2)} className="size-full group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div>
                    <h4 className="body-sm text-slate-800 leading-none mb-1.5 group-hover:text-[#151936] transition-colors">{agent.name}</h4>
                    <p className="text-desc-secondary leading-none text-[11px]">{agent.sold} deals closed</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[#151936] leading-none mb-1 mono-amount">{agent.revenue}</p>
                  <p className="text-slate-400 leading-none label-caps">{agent.timeLabel}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Filtered Property Listings Grid ── */}
      {paginatedListings.length > 0 ? (
        <div className="space-y-4 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
            {paginatedListings.map((card) => (
              <div
                key={card.id}
                className="bg-white border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-4 rounded-[20px] hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group animate-in fade-in zoom-in-95 duration-300 cursor-pointer"
                onClick={() => {
                  setDrawerProperty({
                    id: card.id,
                    name: card.title,
                    location: card.location,
                    type: card.type,
                    status: card.status as "Available" | "Sold" | "Under Offer" | "Occupied",
                    roi: String(card.price),
                    price: `KES ${card.price.toLocaleString()}`,
                    imageUrl: card.media?.[0]?.url || card.imageUrl || null,
                  })
                }}
              >
                <div className="relative aspect-[4/3] w-full rounded-[20px] overflow-hidden shrink-0">
                  <Image
                    src={card.media?.[0]?.url || card.imageUrl}
                    alt={card.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 350px"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent" />

                  <div className="absolute top-3 right-3">
                    <span className={cn(
                      "text-xs font-medium px-3 py-1.5 rounded-full tracking-wide shadow-lg backdrop-blur-md",
                      card.status === "Available" ? "bg-emerald-500/90 text-white border border-emerald-400/50" :
                        card.status === "Occupied" ? "bg-slate-800/90 text-slate-200 border border-slate-600/50" :
                          card.status === "Under Offer" ? "bg-amber-500/90 text-white border border-amber-400/50" : "bg-white/90 text-slate-800 border border-white/50"
                    )}>
                      {card.status}
                    </span>
                  </div>

                  <div className="absolute top-3 left-3">
                    <span className="label-caps px-2.5 py-1 rounded-full border border-white/20 bg-black/50 backdrop-blur-md text-white shadow-sm">
                      {card.type}
                    </span>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h4 className="text-white headline-md leading-tight line-clamp-1 drop-shadow-sm">
                      {card.title}
                    </h4>
                    <p className="text-sm text-slate-300 mt-1 truncate drop-shadow-sm flex items-center gap-1.5">
                      <IconMapPin size={14} className="opacity-70" />
                      {card.location}
                    </p>
                  </div>
                </div>

                <div className="p-4 pt-4 flex flex-col justify-between h-full bg-white">
                  <div className="flex items-end justify-between mb-4">
                    <div className="flex flex-col">
                      <span className="label-caps mb-0.5">Asking Price</span>
                      <p className="text-[#151936] text-body-primary mono-amount">
                        KES {card.price >= 1000000 ? (card.price / 1000000).toFixed(1) + 'M' : (card.price / 1000).toFixed(0) + 'K'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                    <Avatar
                      src={card.agent.avatarUrl || card.agent.img}
                      fallback={card.agent.name.substring(0, 2)}
                      className="size-8 shadow-sm border border-slate-200"
                    />
                    <div className="min-w-0">
                      <p className="text-body-primary text-slate-700 leading-none truncate mb-1">{card.agent.name}</p>
                      <p className="text-desc-secondary leading-none text-[11px] truncate">Property Manager</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              label={`Showing ${paginatedListings.length} of ${filteredListings.length} properties`}
            />
          )}
        </div>
      ) : (
        <div className="w-full h-[200px] flex items-center justify-center bg-white rounded-[20px] border border-slate-100 border-dashed">
          <p className="text-base text-slate-400">No properties match your filter criteria.</p>
        </div>
      )}

      <PropertyDetailDrawer
        open={!!drawerProperty}
        onClose={() => setDrawerProperty(null)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        property={drawerProperty as any}
        onEdit={() => { }}
        onDelete={() => { }}
      />
    </div>
  );
}
