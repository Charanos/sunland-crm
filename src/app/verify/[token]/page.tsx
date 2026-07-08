"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  IconShieldCheck,
  IconShieldOff,
  IconFileText,
  IconClock,
  IconUser,
  IconBuilding,
  IconLock,
} from "@tabler/icons-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatCompactKES } from "@/lib/utils/format";

export default function PublicVerifyPage() {
  const params = useParams();
  const token = params?.token as string;
  
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!token) return;
    const verifyDoc = async () => {
      try {
        const res = await fetch(`/api/reports/verify/${token}`);
        const data = await res.json();
        setResult(data);
      } catch (err) {
        console.error("Verification failed:", err);
      } finally {
        setLoading(false);
      }
    };
    verifyDoc();
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />
        
        <div className="p-6 md:p-8 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <LoadingSpinner size="lg" />
              <p className="text-slate-500 text-sm">Querying secure registry database…</p>
            </div>
          ) : result?.authentic ? (
            <div className="space-y-6">
              {/* Authentic Header */}
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="size-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                  <IconShieldCheck size={36} stroke={1.5} />
                </div>
                <h1 className="text-xl font-medium text-slate-900 tracking-tight">
                  Authentic Sunland Record
                </h1>
                <p className="text-xs text-slate-400 font-mono">
                  Registry Token: {token.slice(0, 16)}…
                </p>
              </div>

              {/* Certificate content */}
              <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 space-y-3 text-slate-700 text-base">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500">
                    <IconFileText size={16} />
                    <span>Document Type</span>
                  </div>
                  <span className="font-medium text-slate-800 capitalize">
                    {result.reportType.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500">
                    <IconClock size={16} />
                    <span>Generated On</span>
                  </div>
                  <span className="font-mono text-slate-800">
                    {new Date(result.generatedAt).toISOString().split("T")[0]}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500">
                    <IconUser size={16} />
                    <span>Signatory Officer</span>
                  </div>
                  <span className="font-medium text-slate-800">
                    {result.generatedByName}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500">
                    <IconBuilding size={16} />
                    <span>Issuing Entity</span>
                  </div>
                  <span className="font-medium text-slate-800">
                    Sunland Group Limited
                  </span>
                </div>
              </div>

              {/* Snapshot Details */}
              <div className="space-y-2">
                <h3 className="label-caps text-slate-400 text-xs">Frozen Data Snapshot</h3>
                <div className="bg-slate-900 rounded-2xl p-4 font-mono text-xs text-emerald-400 space-y-1.5 overflow-x-auto">
                  {Object.entries(result.snapshot || {}).map(([key, val]: any) => (
                    <div key={key} className="flex justify-between gap-4">
                      <span className="text-slate-400">{key}:</span>
                      <span className="text-right">
                        {typeof val === "number" || (typeof val === "string" && !isNaN(val as any) && val.length > 3)
                          ? formatCompactKES(typeof val === "number" ? val : parseFloat(String(val)))
                          : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
              <div className="size-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-sm">
                <IconShieldOff size={36} stroke={1.5} />
              </div>
              <h1 className="text-xl font-medium text-slate-900">
                Invalid Verification Certificate
              </h1>
              <p className="text-slate-500 max-w-sm text-base">
                {result?.error || "The signature token provided does not match any official document registered in the Sunland Enterprise Directory."}
              </p>
            </div>
          )}

          <div className="bg-slate-50 border-t border-slate-100 -mx-6 -mb-6 md:-mx-8 md:-mb-8 p-4 flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
            <IconLock size={14} />
            <span>Immutable Ledger Certificate • Sunland Group</span>
          </div>
        </div>
      </div>
    </div>
  );
}
