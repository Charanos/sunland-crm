import { cn } from "@/lib/utils/cn";

type BadgeTone = "primary" | "neutral" | "success" | "warning" | "risk" | "data";

const tones: Record<BadgeTone, string> = {
  primary: "bg-[var(--primary)] text-[var(--on-primary)]",
  neutral: "bg-black/[0.06] text-[var(--on-surface)]",
  success: "bg-[#e8f7ef] text-[#16623b]",
  warning: "bg-[#fff4cb] text-[#704800]",
  risk: "bg-[#ffeded] text-[#8a1f1f]",
  data: "bg-[#ecf0ff] text-[#203c9d]",
};

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={cn(
        "label-caps inline-flex h-6 items-center rounded-full px-2.5",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
