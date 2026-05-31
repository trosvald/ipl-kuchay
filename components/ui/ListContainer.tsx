import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface ListContainerProps {
  children: ReactNode;
  className?: string;
  /** Show hairline dividers between rows (default: true) */
  divided?: boolean;
}

/**
 * Unified list container for compact admin rows.
 * Provides a single rounded border wrapping all CompactListRow items
 * with optional dividers between them.
 *
 * Replaces the `space-y-3` + individual card approach on mobile,
 * dramatically reducing visual weight and scroll length.
 */
export function ListContainer({
  children,
  className,
  divided = true,
}: Readonly<ListContainerProps>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm",
        className,
      )}
    >
      {divided
        ? wrapWithDividers(children)
        : children}
    </div>
  );
}

function wrapWithDividers(children: ReactNode) {
  // Apply border-b to all except the last child using CSS
  // Using :not(:last-child) pseudo-class approach
  return (
    <div className="divide-y divide-slate-100">
      {children}
    </div>
  );
}
