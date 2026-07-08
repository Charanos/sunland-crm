import type { Icon } from "@tabler/icons-react";
import { BoardHeader } from "@/components/ui/erp-primitives";
import { EmptyState } from "@/components/ui/empty-state";

export function ModulePage({
  eyebrow,
  title,
  description,
  emptyTitle,
  emptyDescription,
  action,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  action: string;
  icon: Icon;
}) {
  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-6">
      <BoardHeader
        eyebrow={<p className="label-caps text-[var(--on-surface-dim)]">{eyebrow}</p>}
        title={title}
        description={description}
      />
      <EmptyState
        action={action}
        description={emptyDescription}
        icon={icon}
        title={emptyTitle}
      />
    </div>
  );
}
