"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { IconBuildingCommunity, IconCheck, IconLoader2, IconNetwork } from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/store/ui";
import { getEntityById } from "@/data/entities";
import { Avatar } from "@/components/ui/avatar";

export function EntitySwitchOverlay() {
  return (
    <Suspense fallback={null}>
      <EntitySwitchOverlayInner />
    </Suspense>
  );
}

function EntitySwitchOverlayInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { switchingToEntityId, setActiveEntityId, setSwitchingToEntityId } = useUIStore();
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initializing connection...");

  const targetEntity = switchingToEntityId ? getEntityById(switchingToEntityId) : null;

  useEffect(() => {
    if (!switchingToEntityId) {
      setProgress(0);
      return;
    }

    // Progress simulation
    setProgress(0);
    setStatusText("Initializing secure channel...");

    const interval = setInterval(() => {
      setProgress((oldProgress) => {
        if (oldProgress >= 100) {
          clearInterval(interval);
          return 100;
        }

        const increment = Math.floor(Math.random() * 12) + 8;
        const nextProgress = Math.min(oldProgress + increment, 100);

        // Update status text based on progress stage
        if (nextProgress > 80) {
          setStatusText("Synchronizing dashboard workspace...");
        } else if (nextProgress > 50) {
          setStatusText("Fetching consolidated ledger & pipelines...");
        } else if (nextProgress > 25) {
          setStatusText("Loading entity-level configuration...");
        }

        return nextProgress;
      });
    }, 180);

    return () => clearInterval(interval);
  }, [switchingToEntityId]);

  // Effect to perform the actual switch once progress is 100%
  useEffect(() => {
    if (progress === 100 && switchingToEntityId && targetEntity) {
      const timeout = setTimeout(() => {
        // Update URL to match active entity
        const params = new URLSearchParams(searchParams.toString());
        params.set("entity", switchingToEntityId);
        router.push(`/admin?${params.toString()}`);

        // Update stores and dismiss
        setActiveEntityId(switchingToEntityId);
        setSwitchingToEntityId(null);
      }, 350); // slight pause at 100% for user satisfaction

      return () => clearTimeout(timeout);
    }
  }, [progress, switchingToEntityId, targetEntity, router, searchParams, setActiveEntityId, setSwitchingToEntityId]);

  if (!switchingToEntityId || !targetEntity) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#070919]/90 px-4 backdrop-blur-xl"
      >
        <motion.div
          initial={{ scale: 0.96, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.96, y: 12 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          className={cn(
            "w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.08]",
            "bg-gradient-to-b from-[#131735]/95 to-[#0d0f26]/98 p-6 md:p-8",
            "shadow-[0_32px_64px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.02)]"
          )}
        >
          {/* Header context */}
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <div className="flex items-center gap-2 text-white/50 text-base uppercase tracking-wider font-medium">
              <IconNetwork size={14} className="animate-pulse text-[var(--primary)]" />
              <span>Switching Context</span>
            </div>
            <div className="text-sm font-mono text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded-full border border-[var(--primary)]/20">
              {progress}% Loaded
            </div>
          </div>

          {/* Active connection diagram */}
          <div className="my-6 flex items-center justify-center gap-6">
            <div className="flex size-14 items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <IconBuildingCommunity size={26} className="text-white/60" />
            </div>
            <div className="flex flex-1 items-center justify-center px-2">
              <div className="relative h-[2px] w-full bg-white/[0.06] overflow-hidden rounded-full">
                <motion.div
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <div className="flex size-14 items-center justify-center overflow-hidden rounded-xl border border-white/[0.12] bg-white/[0.08] shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
              <img
                src={targetEntity.avatarUrl}
                alt={targetEntity.name}
                className="size-full object-cover"
              />
            </div>
          </div>

          {/* Connection detail info */}
          <div className="text-center">
            <h2 className="text-[18px] font-medium tracking-tight text-white/95">
              {targetEntity.name}
            </h2>
            <p className="mt-1 text-base text-white/45 font-medium">{targetEntity.subtitle}</p>
            <p className="mt-3 text-base leading-relaxed text-white/70 bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl">
              {targetEntity.description}
            </p>
          </div>

          {/* Stats Breakdown (Fades in partially) */}
          <div className="mt-6 grid grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3 text-center transition hover:border-white/[0.08]">
              <span className="block text-sm font-medium uppercase tracking-wider text-white/35">Properties</span>
              <motion.span
                animate={{ opacity: progress > 30 ? 1 : 0.2 }}
                className="mt-1.5 block font-mono text-[16px] font-medium text-white/90"
              >
                {progress > 30 ? targetEntity.stats.properties : "—"}
              </motion.span>
            </div>
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3 text-center transition hover:border-white/[0.08]">
              <span className="block text-sm font-medium uppercase tracking-wider text-white/35">Contacts</span>
              <motion.span
                animate={{ opacity: progress > 55 ? 1 : 0.2 }}
                className="mt-1.5 block font-mono text-[16px] font-medium text-white/90"
              >
                {progress > 55 ? targetEntity.stats.contacts : "—"}
              </motion.span>
            </div>
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3 text-center transition hover:border-white/[0.08]">
              <span className="block text-sm font-medium uppercase tracking-wider text-white/35">Revenue</span>
              <motion.span
                animate={{ opacity: progress > 80 ? 1 : 0.2 }}
                className="mt-1.5 block font-mono text-base  font-medium text-[var(--primary)]"
              >
                {progress > 80 ? targetEntity.stats.revenue : "—"}
              </motion.span>
            </div>
          </div>

          {/* Loading status text & spinner */}
          <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-4">
            <span className="text-base font-medium text-white/50">{statusText}</span>
            {progress < 100 ? (
              <IconLoader2 size={16} className="animate-spin text-[var(--primary)]" />
            ) : (
              <IconCheck size={16} className="text-[var(--success)]" />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
