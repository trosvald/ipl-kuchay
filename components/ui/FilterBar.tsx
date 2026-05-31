import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

/**
 * Layout wrapper for filter controls (search input, selects, toggles).
 * Clean horizontal row on desktop, stacked on mobile.
 */
export function FilterBar({ children, className }: Readonly<FilterBarProps>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface FilterGroupProps {
  label?: string;
  children: ReactNode;
  className?: string;
}

export function FilterGroup({
  label,
  children,
  className,
}: Readonly<FilterGroupProps>) {
  return (
    <div className={cn("flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3", className)}>
      {label ? (
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      ) : null}
      {children}
    </div>
  );
}
