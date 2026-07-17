"use client";

import { useEffect, useState } from "react";
import { IconChevronDown, IconInbox } from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";
import { formatCompactKES, formatKES } from "@/lib/utils/format";

interface StreamTransaction {
  id: string;
  occurredAt: string;
  amountKes: number;
  counterparty: string | null;
  propertyName: string | null;
  notes: string | null;
}

interface RevenueStream {
  key: string;
  label: string;
  totalKes: number;
  transactionCount: number;
  transactions: StreamTransaction[];
}

interface RevenueStreamResponse {
  periodStart: string;
  periodEnd: string;
  totalRevenueKes: number;
  streams: RevenueStream[];
}

export default function RevenueStreamDropdown({ entityId = "group" }: { entityId?: string }) {
  const [data, setData] = useState<RevenueStreamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/finance/revenue-streams?entityId=${entityId}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  if (loading) {
    return (
      <div className="w-full space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton-shimmer h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data || data.streams.every((s) => s.transactionCount === 0)) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-10 w-full text-slate-400">
        <IconInbox size={28} className="mb-2 opacity-50" />
        <p className="text-sm">No revenue recorded for this period yet.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {data.streams.map((stream) => {
        const isOpen = expandedKey === stream.key;
        const pct = data.totalRevenueKes > 0 ? Math.round((stream.totalKes / data.totalRevenueKes) * 100) : 0;

        return (
          <div key={stream.key} className="rounded-xl border border-slate-100 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedKey(isOpen ? null : stream.key)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/80 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <IconChevronDown
                  size={16}
                  className={cn("text-slate-400 shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
                />
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{stream.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {stream.transactionCount} {stream.transactionCount === 1 ? "transaction" : "transactions"} · {pct}% of revenue
                  </p>
                </div>
              </div>
              <span className="mono-data text-slate-900 shrink-0 ml-3">{formatCompactKES(stream.totalKes)}</span>
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 bg-slate-50/40 max-h-64 overflow-y-auto custom-scrollbar">
                {stream.transactions.length === 0 ? (
                  <p className="text-sm text-slate-400 px-4 py-4 text-center">No transactions in this stream for the period.</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {stream.transactions.map((t) => (
                        <tr key={t.id} className="border-b border-slate-100/80 last:border-0">
                          <td className="px-4 py-2.5 text-slate-400 font-mono text-xs whitespace-nowrap">
                            {new Date(t.occurredAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}
                          </td>
                          <td className="px-2 py-2.5 text-slate-700 truncate max-w-[160px]">
                            {t.counterparty ?? t.propertyName ?? "—"}
                          </td>
                          <td className="px-2 py-2.5 text-slate-400 truncate max-w-[180px] hidden md:table-cell">{t.notes}</td>
                          <td className="px-4 py-2.5 text-right mono-data text-slate-800 whitespace-nowrap">{formatKES(t.amountKes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
