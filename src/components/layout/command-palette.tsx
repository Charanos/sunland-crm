"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconSearch,
  IconX,
  IconCommand,
  IconChevronRight,
  IconBuildingCommunity,
  IconUser,
  IconReceipt,
  IconFileText,
  IconBriefcase,
} from "@tabler/icons-react";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils/cn";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "property", label: "Properties" },
  { id: "client", label: "Clients" },
  { id: "lease", label: "Leases" },
  { id: "payment", label: "Payments" },
  { id: "staff", label: "Staff" },
];

const SEARCH_RESULTS = [
  { id: "prop-1", title: "Acacia Court", subtitle: "Property · Westlands, Nairobi", type: "property" },
  { id: "prop-2", title: "Sunset Apartments", subtitle: "Property · Kilimani, Nairobi", type: "property" },
  { id: "prop-3", title: "The Atrium", subtitle: "Property · Upper Hill, Nairobi", type: "property" },
  { id: "client-1", title: "James Kariuki", subtitle: "Client · Active", type: "client" },
  { id: "client-2", title: "Esther Howard", subtitle: "Client · Prospect", type: "client" },
  { id: "client-3", title: "Safaricom PLC", subtitle: "Client · Corporate", type: "client" },
  { id: "lease-1", title: "Acacia Court - Unit 4B", subtitle: "Lease · Expires in 14 days", type: "lease" },
  { id: "lease-2", title: "The Atrium - Floor 3", subtitle: "Lease · Active", type: "lease" },
  { id: "pay-1", title: "TXN-4821 (KES 95,000)", subtitle: "Payment · Rent · Esther Howard", type: "payment" },
  { id: "pay-2", title: "TXN-4822 (KES 120,000)", subtitle: "Payment · Rent · James Kariuki", type: "payment" },
  { id: "staff-1", title: "Paul Amos", subtitle: "Staff · CEO", type: "staff" },
  { id: "staff-2", title: "Jane Doe", subtitle: "Staff · Property Manager", type: "staff" },
];

const getIconForType = (type: string) => {
  switch (type) {
    case "property": return <IconBuildingCommunity size={14} stroke={1.5} aria-hidden />;
    case "client": return <IconUser size={14} stroke={1.5} aria-hidden />;
    case "payment": return <IconReceipt size={14} stroke={1.5} aria-hidden />;
    case "lease": return <IconFileText size={14} stroke={1.5} aria-hidden />;
    case "staff": return <IconBriefcase size={14} stroke={1.5} aria-hidden />;
    default: return <IconCommand size={14} stroke={1.5} aria-hidden />;
  }
};

// ─── Component ─────────────────────────────────────────────────────────────

export function CommandPalette() {
  const { searchOpen, closeSearch } = useUIStore();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter results dynamically
  const filteredResults = SEARCH_RESULTS.filter(
    (item) => {
      const matchesQuery = item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(query.toLowerCase());
      const matchesFilter = activeFilter === "all" || item.type === activeFilter;
      return matchesQuery && matchesFilter;
    }
  );

  // Focus input on open
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      Promise.resolve().then(() => {
        setActiveIndex(0);
        setQuery("");
        setActiveFilter("all");
      });
    }
  }, [searchOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!searchOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev < filteredResults.length - 1 ? prev + 1 : prev));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const activeItem = filteredResults[activeIndex];
        if (activeItem) {
          // In a real app, we would router.push() here
          closeSearch();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeSearch();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen, activeIndex, filteredResults, closeSearch]);

  // Scroll active item into view
  useEffect(() => {
    if (containerRef.current) {
      const activeEl = containerRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex]);

  if (!searchOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[15vh]">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={closeSearch}
          aria-hidden="true"
        />

        {/* Dialog */}
        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex w-full max-w-[680px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] ring-1 ring-slate-200/50"
        >
          {/* Header row: Search Input */}
          <div className="flex items-center gap-4 px-6 py-5">
            <IconSearch size={24} className="text-slate-400 shrink-0" stroke={1.5} aria-hidden />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              placeholder="Search clients, properties, leases..."
              className="flex-1 bg-transparent text-md font-light text-slate-800 placeholder:text-slate-300 focus:outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center justify-center rounded-[6px] border border-slate-200 bg-slate-50 px-2 py-0.5 text-xxs font-medium text-slate-400">
              ESC
            </kbd>
            <button
              type="button"
              onClick={closeSearch}
              className="sm:hidden flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <IconX size={20} stroke={1.5} aria-hidden />
            </button>
          </div>

          {/* Filter Pills - softer aesthetic */}
          <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-100/60 bg-white px-6 pb-4 scrollbar-none">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => {
                  setActiveFilter(filter.id);
                  setActiveIndex(0);
                  inputRef.current?.focus();
                }}
                className={cn(
                  "flex shrink-0 items-center rounded-full px-3.5 py-1.5 text-xs font-medium tracking-wide transition-all",
                  activeFilter === filter.id
                    ? "bg-tertiary-gradient text-white shadow-sm"
                    : "bg-slate-100/50 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Search Results */}
          <div
            ref={containerRef}
            className="max-h-[50vh] overflow-y-auto bg-slate-50/30 p-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200"
          >
            {filteredResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
                  <IconSearch size={24} stroke={1.5} aria-hidden />
                </div>
                <p className="text-base font-medium text-slate-800">No matching results found</p>
                <p className="text-sm text-slate-400 mt-1">Try tweaking your search terms.</p>
              </div>
            ) : (
              filteredResults.map((item, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => closeSearch()}
                    className={cn(
                      "group flex w-full items-center justify-between rounded-[14px] px-4 py-3.5 transition-all duration-200",
                      isActive ? "bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60" : "bg-transparent hover:bg-white hover:shadow-sm"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      {/* Left Icon Box */}
                      <div
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                          isActive
                            ? "bg-[var(--sidebar)] text-white shadow-md shadow-slate-900/10"
                            : "bg-slate-100 text-slate-400 group-hover:bg-slate-200/50 group-hover:text-slate-600"
                        )}
                      >
                        {getIconForType(item.type)}
                      </div>

                      {/* Text Stack */}
                      <div className="flex flex-col text-left">
                        <span className={cn(
                          "text-sm font-medium transition-colors",
                          isActive ? "text-slate-900" : "text-slate-700"
                        )}>
                          {item.title}
                        </span>
                        <span className="text-xs font-normal text-slate-400 mt-0.5">
                          {item.subtitle}
                        </span>
                      </div>
                    </div>

                    {/* Right Arrow / Action Hint */}
                    <div className={cn(
                      "flex items-center gap-2 transition-all duration-200",
                      isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
                    )}>
                      <span className="text-xs font-medium text-slate-400 hidden sm:inline-block">Jump to</span>
                      <IconChevronRight size={16} stroke={2} className="text-slate-400" aria-hidden />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
