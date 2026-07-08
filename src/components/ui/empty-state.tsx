import type { Icon } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: IconComponent,
  title,
  description,
  action,
  onClick,
}: {
  icon: Icon;
  title: string;
  description: string;
  action: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--outline)] bg-white px-6 py-10 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--surface-high)] text-[var(--on-primary)]">
        <IconComponent aria-hidden size={22} stroke={1.8} />
      </div>
      <h2 className="headline-md">{title}</h2>
      <p className="body-sm mt-2 max-w-sm text-[var(--on-surface-dim)]">
        {description}
      </p>
      <Button onClick={onClick} className="mt-5">{action}</Button>
    </div>
  );
}
