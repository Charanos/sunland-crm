import { cn } from "@/lib/utils/cn";

type BadgeTone = "primary" | "neutral" | "success" | "warning" | "risk" | "data" | "brand";

const tones: Record<BadgeTone, string> = {
  primary: "badge-tone-primary",
  neutral: "badge-tone-neutral",
  success: "badge-tone-success",
  warning: "badge-tone-warning",
  risk: "badge-tone-risk",
  data: "badge-tone-data",
  brand: "badge-tone-brand",
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
    <span className={cn("badge-pill", tones[tone], className)}>
      {children}
    </span>
  );
}

