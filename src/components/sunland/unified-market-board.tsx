"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Avatar } from "@/components/ui/avatar";
import { IconArrowUpRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";

type PropertyType = "All Properties" | "Apartment" | "Commercial" | "House" | "Land" | "Villa";

interface Agent {
  name: string;
  sold: number;
  rented: number;
  revenue: string;
  img: string;
}

interface ListingCard {
  id: string;
  title: string;
  type: PropertyType;
  location: string;
  price: number;
  status: "Available" | "Occupied" | "Under Offer" | "Sold";
  imageUrl: string;
  agent: Agent;
}

const AGENTS: Record<string, Agent> = {
  aurther: { name: 'Aurther Morgan', sold: 90, rented: 60, revenue: '$2.5M', img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face' },
  michele: { name: 'Michele Morgan', sold: 90, rented: 60, revenue: '$2.5M', img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face' },
  michael: { name: 'Michael Bennett', sold: 110, rented: 40, revenue: '$2.3M', img: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face' },
  daniel: { name: 'Daniel Rivera', sold: 85, rented: 35, revenue: '$2.1M', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face' },
  sarah: { name: 'Sarah Jenkins', sold: 85, rented: 35, revenue: '$2.1M', img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=face' },
};

const MASTER_INVENTORY: ListingCard[] = [
  { id: "1", title: "Runda Grove Villa", type: "House", location: "Runda, Nairobi", price: 21300000, status: "Available", imageUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=400&h=260&q=80", agent: AGENTS.aurther },
  { id: "2", title: "Muthaiga Grand Estate", type: "House", location: "Muthaiga, Nairobi", price: 150000000, status: "Occupied", imageUrl: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=400&h=260&q=80", agent: AGENTS.michael },
  { id: "3", title: "Westlands Tower 4B", type: "Apartment", location: "Westlands, Nairobi", price: 720000, status: "Occupied", imageUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&h=260&q=80", agent: AGENTS.michele },
  { id: "4", title: "Gigiri Diplomatic Suites", type: "Apartment", location: "Gigiri, Nairobi", price: 1200000, status: "Under Offer", imageUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&h=260&q=80", agent: AGENTS.daniel },
  { id: "5", title: "Lavington Gardens", type: "Villa", location: "Lavington, Nairobi", price: 48000000, status: "Available", imageUrl: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=400&h=260&q=80", agent: AGENTS.sarah },
  { id: "6", title: "Karen Ridge Townhome", type: "Villa", location: "Karen, Nairobi", price: 62000000, status: "Sold", imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&h=260&q=80", agent: AGENTS.aurther },
  { id: "7", title: "Upper Hill Plaza", type: "Commercial", location: "Upper Hill, Nairobi", price: 120000000, status: "Available", imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400&h=260&q=80", agent: AGENTS.michael },
  { id: "8", title: "Kilimani Tech Hub", type: "Commercial", location: "Kilimani, Nairobi", price: 85000000, status: "Occupied", imageUrl: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=400&h=260&q=80", agent: AGENTS.michele },
  { id: "9", title: "Nanyuki Prime Plot", type: "Land", location: "Nanyuki", price: 15000000, status: "Available", imageUrl: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=400&h=260&q=80", agent: AGENTS.sarah },
];

export function UnifiedMarketBoard() {
  const [activeType, setActiveType] = useState<PropertyType>("All Properties");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter listings based on active tab and search query
  const filteredListings = useMemo(() => {
    return MASTER_INVENTORY.filter(listing => {
      const matchesType = activeType === "All Properties" || listing.type === activeType;
      const matchesSearch = listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.location.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [activeType, searchQuery]);

  // Derived Analytics Data based on filter
  const analytics = useMemo(() => {
    let revenueMultiplier = 1;
    let occupancyBase = 0.83;
    let totalProps = 3786;

    // Simulate real-time data shifts when filtering
    switch (activeType) {
      case "House": revenueMultiplier = 0.4; occupancyBase = 0.91; totalProps = 1514; break;
      case "Villa": revenueMultiplier = 0.12; occupancyBase = 0.75; totalProps = 454; break;
      case "Apartment": revenueMultiplier = 0.20; occupancyBase = 0.88; totalProps = 757; break;
      case "Commercial": revenueMultiplier = 0.18; occupancyBase = 0.65; totalProps = 303; break;
      case "Land": revenueMultiplier = 0.10; occupancyBase = 0.0; totalProps = 152; break;
    }

    const currentRevenue = 5120 * revenueMultiplier;
    const occupiedPercent = Math.round(occupancyBase * 100);
    const vacantPercent = 100 - occupiedPercent;

    // Top agents specific to this filter (shuffle/slice to simulate changing ranks)
    const agents = Object.values(AGENTS).sort((a, b) => a.name.length - b.name.length + Math.sin(totalProps)).slice(0, 5);

    return {
      revenue: currentRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      growth: `+${(Math.abs(Math.sin(totalProps)) * 20 + 5).toFixed(1)}`,
      totalProps: totalProps.toLocaleString(),
      occupiedPercent,
      vacantPercent,
      agents
    };
  }, [activeType]);

  return (
    <div className="w-full my-12 md:my-16">
      {/* ── Unified Header & Controls ── */}
      <div className="py-6 border-t border-slate-200/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="title-serif text-slate-900 text-[22px]">Market Insights & Portfolio</h2>
          <p className="text-[12px] text-slate-500 font-medium tracking-wide mt-1">Real-time analytical breakdown and inventory tracking.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Property Type Filter Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-x-auto mt-1 lg:mt-0">
            {(["All Properties", "Apartment", "Commercial", "House", "Land", "Villa"] as PropertyType[]).map((type) => (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-md transition-all font-medium tracking-wide whitespace-nowrap",
                  activeType === type
                    ? "bg-[#15464e] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                )}
              >
                {type}
              </button>
            ))}
          </div>

          <input
            type="search"
            placeholder="Search listings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-[34px] rounded-lg border border-slate-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] pl-3 pr-3 text-[12px] text-slate-700 placeholder:text-slate-400 focus:border-[#15464e]/40 focus:outline-none transition-all w-[180px] mt-1 lg:mt-0"
          />
        </div>
      </div>

      {/* ── Market Insights Tier ── */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch w-full mb-6 mt-1">
        {/* Market Revenue Overview */}
        <div className="xl:col-span-5 bg-white rounded-[20px] p-6 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between group hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-[17px] font-medium text-slate-900 tracking-tight mb-1">Market Revenue Overview</h3>
              <p className="text-[12px] text-slate-500 font-medium">Available rental income this month</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="text-[28px] font-mono text-slate-900 font-medium leading-none">${analytics.revenue}</span>
                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full flex items-center shadow-sm">
                  {analytics.growth}
                </span>
              </div>
            </div>
            <div className="size-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shadow-sm">
              <IconArrowUpRight size={16} stroke={2} />
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-end">
            <div className="flex items-end justify-between h-[120px] gap-[2px] mt-4 mb-2 relative overflow-hidden">
              {/* Dynamic Bar Chart representation */}
              {Array.from({ length: 47 }).map((_, i) => {
                const h = activeType === "All Properties"
                  ? Math.max(20, Math.sin(i * 0.2) * 40 + 50 + (Math.sin(i * 0.5) * 10 - 5))
                  : Math.max(10, Math.sin(i * 0.4) * 30 + 40 + (Math.sin(i * 0.8) * 20 - 10));
                return (
                  <div key={i} className="w-full bg-[#15464e] rounded-t-[2px] transition-all duration-700 hover:opacity-80" style={{ height: `${h}%` }}></div>
                )
              })}
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-medium border-b border-slate-100 pb-3 mb-4">
              <span>Mon</span>
              <span>Sun</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="size-[12px] rounded-[3px] bg-[#15464e]"></div>
                <span className="text-[11px] text-slate-500 font-medium">Occupied Units - {analytics.occupiedPercent}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-[12px] rounded-[3px] bg-[#eef2f6] border border-slate-200"></div>
                <span className="text-[11px] text-slate-500 font-medium">Vacant Units - {analytics.vacantPercent}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Properties Types Donut */}
        <div className="xl:col-span-4 bg-white rounded-[20px] p-6 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col hover:shadow-md transition-all">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[16px] font-medium text-slate-900 tracking-tight">Properties Types</h3>
            <span className="text-[11px] font-medium text-[#15464e] bg-[#eef2f6] px-2.5 py-1 rounded-md border border-[#eef2f6]/50">{activeType}</span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center mb-6 mt-2">
            <div className="relative size-[140px] flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 drop-shadow-sm">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f8fafc" strokeWidth="16" />
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#0f766e" strokeWidth="16" strokeDasharray="251.2" strokeDashoffset={activeType === 'House' || activeType === 'All Properties' ? '150.72' : '251.2'} className="transition-all duration-700" />
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#0ea5e9" strokeWidth="16" strokeDasharray="251.2" strokeDashoffset={activeType === 'Apartment' || activeType === 'All Properties' ? '200.96' : '251.2'} transform="rotate(144 50 50)" className="transition-all duration-700" />
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#d97706" strokeWidth="16" strokeDasharray="251.2" strokeDashoffset={activeType === 'Villa' || activeType === 'All Properties' ? '221.05' : '251.2'} transform="rotate(216 50 50)" className="transition-all duration-700" />
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#4f46e5" strokeWidth="16" strokeDasharray="251.2" strokeDashoffset={activeType === 'Commercial' || activeType === 'All Properties' ? '231.1' : '251.2'} transform="rotate(259 50 50)" className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-full m-[22px] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                <span className="text-[18px] font-mono font-medium text-slate-800 leading-none mb-1 tracking-tight">{analytics.totalProps}</span>
                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest text-center leading-[1.2]">Total<br />{activeType === 'All Properties' ? 'Property' : activeType}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-y-5 gap-x-2 mt-auto">
            <div className={cn("flex items-center gap-3 transition-opacity duration-300", activeType !== 'All Properties' && activeType !== 'House' ? 'opacity-30' : 'opacity-100')}>
              <div className="size-[34px] rounded-xl bg-[#0f766e] flex items-center justify-center text-[11px] font-medium text-white shadow-sm">40%</div>
              <div>
                <p className="text-[11px] text-slate-500 font-medium leading-none mb-1">House</p>
                <p className="text-[13px] text-slate-800 font-mono font-medium leading-none">1,514</p>
              </div>
            </div>
            <div className={cn("flex items-center gap-3 transition-opacity duration-300", activeType !== 'All Properties' && activeType !== 'Villa' ? 'opacity-30' : 'opacity-100')}>
              <div className="size-[34px] rounded-xl bg-[#d97706] flex items-center justify-center text-[11px] font-medium text-white shadow-sm">12%</div>
              <div>
                <p className="text-[11px] text-slate-500 font-medium leading-none mb-1">Villa</p>
                <p className="text-[13px] text-slate-800 font-mono font-medium leading-none">454</p>
              </div>
            </div>
            <div className={cn("flex items-center gap-3 transition-opacity duration-300", activeType !== 'All Properties' && activeType !== 'Apartment' ? 'opacity-30' : 'opacity-100')}>
              <div className="size-[34px] rounded-xl bg-[#0ea5e9] flex items-center justify-center text-[11px] font-medium text-white shadow-sm">20%</div>
              <div>
                <p className="text-[11px] text-slate-500 font-medium leading-none mb-1">Apartment</p>
                <p className="text-[13px] text-slate-800 font-mono font-medium leading-none">757</p>
              </div>
            </div>
            <div className={cn("flex items-center gap-3 transition-opacity duration-300", activeType !== 'All Properties' && activeType !== 'Commercial' ? 'opacity-30' : 'opacity-100')}>
              <div className="size-[34px] rounded-xl bg-[#4f46e5] flex items-center justify-center text-[11px] font-medium text-white shadow-sm">8%</div>
              <div>
                <p className="text-[11px] text-slate-500 font-medium leading-none mb-1">Commercial</p>
                <p className="text-[13px] text-slate-800 font-mono font-medium leading-none">303</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Agents */}
        <div className="xl:col-span-3 bg-white rounded-[20px] p-6 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col hover:shadow-md transition-all">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[16px] font-medium text-slate-900 tracking-tight">Top Agents</h3>
            <button className="text-[11px] font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 hover:bg-slate-100 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.03)]">This Month ⌄</button>
          </div>

          <div className="flex flex-col gap-[18px] mt-1">
            {analytics.agents.map((agent, i) => (
              <div key={`${agent.name}-${i}`} className="flex items-center justify-between group animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}>
                <div className="flex items-center gap-3">
                  <div className="size-[38px] rounded-full overflow-hidden border border-slate-100 shadow-sm relative shrink-0">
                    <Image src={agent.img} alt={agent.name} fill sizes="40px" className="object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-medium text-slate-800 leading-none mb-1.5 group-hover:text-[#15464e] transition-colors">{agent.name}</h4>
                    <p className="text-[10.5px] text-slate-400 font-medium leading-none">{agent.sold} sold - {agent.rented} rented</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-mono font-medium text-[#15464e] leading-none mb-1">{agent.revenue}</p>
                  <p className="text-[9px] text-slate-400 font-medium uppercase tracking-widest leading-none">annually</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Filtered Property Listings Grid ── */}
      {filteredListings.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {filteredListings.map((card) => (
            <div key={card.id} className="bg-white border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-4 rounded-[20px] hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group animate-in fade-in zoom-in-95 duration-300">
              <div>
                <div className="relative aspect-[16/10] w-full rounded-[14px] overflow-hidden shrink-0 shadow-sm border border-slate-100/50">
                  <Image
                    src={card.imageUrl}
                    alt={card.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 250px"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-2 right-2">
                    <span className={cn(
                      "text-[10px] px-2.5 py-1 rounded-md font-medium tracking-wide whitespace-nowrap shadow-sm",
                      card.status === "Available" ? "bg-[#e6f4ea] text-[#1b431e]" :
                        card.status === "Occupied" ? "bg-[#eef2f6] text-[#24354a]" :
                          card.status === "Under Offer" ? "bg-[#fcf0e4] text-[#5e2b17]" : "bg-slate-100 text-slate-600"
                    )}>
                      {card.status}
                    </span>
                  </div>
                  <div className="absolute top-2 left-2">
                    <span className="text-[10px] px-2 py-0.5 rounded border border-white/20 bg-black/40 backdrop-blur-md text-white font-medium shadow-sm">
                      {card.type}
                    </span>
                  </div>
                </div>
                <h4 className="text-[14px] font-medium text-slate-800 mt-4 leading-snug line-clamp-1 group-hover:text-[#15464e] transition-colors">
                  {card.title}
                </h4>
                <p className="text-[11.5px] text-slate-400 font-medium mt-1 truncate">{card.location}</p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={card.agent.img}
                    fallback={card.agent.name.substring(0, 2)}
                    className="size-8 shadow-sm border border-slate-100"
                  />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-slate-700 leading-none truncate mb-1">{card.agent.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium leading-none truncate">Listing Agent</p>
                  </div>
                </div>
                <p className="text-[14px] font-mono font-medium text-[#15464e] tracking-tight">KES {card.price >= 1000000 ? (card.price / 1000000).toFixed(1) + 'M' : (card.price / 1000).toFixed(0) + 'K'}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="w-full h-[200px] flex items-center justify-center bg-white rounded-[20px] border border-slate-100 border-dashed">
          <p className="text-[13px] text-slate-400 font-medium">No properties match your filter criteria.</p>
        </div>
      )}
    </div>
  );
}
