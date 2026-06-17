import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export function Avatar({
  alt,
  className,
  fallback,
  shape = "circle",
  src,
  status,
}: {
  alt?: string;
  className?: string;
  fallback: string;
  shape?: "circle" | "rounded-lg";
  src?: string;
  status?: "online" | "busy" | "away";
}) {
  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-lg";

  return (
    // Outer shell: no overflow-hidden so the status dot can bleed outside
    <span
      className={cn(
        "relative inline-flex size-10 shrink-0 items-center justify-center bg-[var(--primary)] text-sm font-medium text-[var(--on-primary)]",
        shapeClass,
        className,
      )}
    >
      {src ? (
        // Inner image wrapper clips the photo to the shape, independently of the dot
        <span className={cn("absolute inset-0 overflow-hidden", shapeClass)}>
          <Image
            alt={alt ?? fallback}
            className="object-cover"
            fill
            sizes="40px"
            src={src}
          />
        </span>
      ) : (
        <span className="relative z-10">{fallback}</span>
      )}

      {/* Status dot: sits outside the overflow-hidden image wrapper */}
      {status ? (
        <span
          className={cn(
            // Offset slightly outward: translate(25%, 25%) from the bottom-right corner
            "absolute -bottom-[1.5px] -right-[1.5px] size-[9px] rounded-full",
            "border-[1.5px] border-[var(--sidebar)] z-20",
            status === "online" && "bg-[var(--success)]",
            status === "busy" && "bg-[var(--error)]",
            status === "away" && "bg-[var(--warning)]",
          )}
        />
      ) : null}
    </span>
  );
}
