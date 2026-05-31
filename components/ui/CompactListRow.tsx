import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface CompactListRowProps {
  children?: ReactNode;
  className?: string;

  /** Primary identifier text or element (top line, truncated) */
  primary: ReactNode;

  /** Trailing element (top line, right-aligned) — amount or badge */
  trailing?: ReactNode;

  /** Subtitle / status / owner / period (second line) */
  secondary?: ReactNode;

  /** Expanded detail content — compact lines + inline h-8 actions */
  expanded?: ReactNode;

  /** Whether the expanded area is visible */
  expandedOpen?: boolean;

  /** Toggle handler for expand/collapse */
  onToggle?: () => void;

  /** Accent left border color class (e.g. "border-l-emerald-500") */
  accentColor?: string;

  /** Tap handler for the row itself (without expand) */
  onClick?: () => void;
}

/**
 * Compact admin list row — dense, scan-friendly, native-feeling.
 *
 * Layout:
 *   top line:    primary (left) + trailing (right)
 *   second line: secondary (full width)
 *   expanded:    optional detail/action area (visible when expandedOpen is true)
 *
 * Use inside a ListContainer for unified border treatment.
 */
export function CompactListRow({
  children,
  className,
  primary,
  trailing,
  secondary,
  expanded,
  expandedOpen = false,
  onToggle,
  accentColor,
  onClick,
}: Readonly<CompactListRowProps>) {
  const hasExpand = !!expanded;
  const interactive = !!onClick || hasExpand;
  const handleClick = onClick ?? onToggle;

  return (
    <div
      className={cn(
        "border-l-4 bg-white px-3.5 py-2.5",
        accentColor,
        interactive && "cursor-pointer transition-colors active:bg-slate-50",
        className,
      )}
    >
      {/* Top line: primary + trailing */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-slate-900">
            {primary}
          </p>
        </div>
        {trailing ? (
          <div className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
            {trailing}
          </div>
        ) : null}
      </div>

      {/* Second line: subtitle / status */}
      {secondary ? (
        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
          {secondary}
        </div>
      ) : null}

      {/* Children — rendered between secondary and expanded */}
      {children ? (
        <div className="mt-1 text-xs text-slate-600">{children}</div>
      ) : null}

      {/* Expand toggle */}
      {hasExpand ? (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.();
            }}
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-800"
          >
            <svg
              className={cn(
                "size-3.5 transition-transform duration-150",
                expandedOpen && "rotate-180",
              )}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {expandedOpen ? "Tutup detail" : "Detail & aksi"}
          </button>
        </div>
      ) : null}

      {/* Expanded detail area */}
      {expandedOpen && expanded ? (
        <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
          {expanded}
        </div>
      ) : null}
    </div>
  );
}
