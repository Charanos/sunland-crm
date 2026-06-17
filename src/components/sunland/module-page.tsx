import type { Icon } from "@tabler/icons-react";
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
    <div className="mx-auto flex max-w-[88rem] flex-col gap-6">
      <section>
        <p className="label-caps text-[var(--on-surface-dim)]">{eyebrow}</p>
        <h1 className="headline-lg mt-2">{title}</h1>
        <p className="body-md mt-2 max-w-2xl text-[var(--on-surface-dim)]">
          {description}
        </p>
      </section>
      <EmptyState
        action={action}
        description={emptyDescription}
        icon={icon}
        title={emptyTitle}
      />
    </div>
  );
}
