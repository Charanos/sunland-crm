import { cn } from "@/lib/utils/cn";

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-black/[0.06]",
        className,
      )}
    />
  );
}
