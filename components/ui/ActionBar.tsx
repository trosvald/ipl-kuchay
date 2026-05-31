import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface ActionBarProps {
  children: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
  /**
   * Compact inline layout with h-8 buttons and tighter gaps.
   * Use inside expanded detail areas (default: false).
   */
  compact?: boolean;
}

/**
 * Action group layout.
 * - Mobile: stacked full-width buttons (vertical).
 * - Desktop: inline row with optional alignment.
 *
 * Designed for use inside MobileEntityCard / CompactListRow actions or standalone.
 *
 * When `compact` is true (use inside expanded detail sections):
 * - Inline row at all breakpoints with h-8 buttons and tighter gap.
 */
export function ActionBar({
  children,
  align = "start",
  className,
  compact = false,
}: Readonly<ActionBarProps>) {
  const alignClass: Record<string, string> = {
    start: "sm:justify-start",
    center: "sm:justify-center",
    end: "sm:justify-end",
  };

  if (compact) {
    return (
      <div
        className={cn(
          "flex flex-row flex-wrap items-center gap-1.5",
          alignClass[align],
          className,
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center",
        alignClass[align],
        className,
      )}
    >
      {children}
    </div>
  );
}
