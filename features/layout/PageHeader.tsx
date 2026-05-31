import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  /** Smaller label above the title — rendered in indigo accent */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Action buttons or controls rendered in the header */
  actions?: ReactNode;
  className?: string;
}

/**
 * Stronger admin page header with indigo accent eyebrow.
 *
 * - Mobile: stacked with full-width title, actions wrap below.
 * - Desktop: title left, actions right.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: Readonly<PageHeaderProps>) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <p className="admin-eyebrow">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-sm text-slate-500">{subtitle}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
