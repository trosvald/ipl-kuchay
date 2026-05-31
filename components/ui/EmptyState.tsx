import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Large, centered empty state with a prominent icon area.
 * Uses the white elevated card style.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: Readonly<EmptyStateProps>) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border border-slate-200/70 bg-white px-6 py-14 text-center shadow-sm",
        className,
      )}
    >
      <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-100">
        <Icon className="size-7 text-slate-400" />
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-bold text-slate-900">{title}</p>
        {description ? (
          <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
