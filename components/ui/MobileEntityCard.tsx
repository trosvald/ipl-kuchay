import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface MobileEntityCardProps {
  children?: ReactNode;
  className?: string;
  onClick?: () => void;

  /* ── Convenience slots ── */

  /** Primary heading text */
  title?: ReactNode;
  /** Secondary text below title */
  subtitle?: ReactNode;
  /** Status badge or indicator (rendered top-right) */
  badge?: ReactNode;

  /**
   * Key-value data area. Each child should be a label-value pair.
   * Rendered as a grid with clean label/value styling.
   */
  meta?: ReactNode;

  /** Action buttons rendered at the bottom, separated by a divider */
  actions?: ReactNode;

  /** Accent color class for the left border stripe (e.g. "border-l-indigo-500") */
  accentColor?: string;
}

/**
 * Redesigned mobile entity card with:
 * - White elevated appearance
 * - Left accent color border stripe
 * - Clear title + badge header
 * - Clean label-value rows for meta
 * - Divider-separated action area at bottom
 */
export function MobileEntityCard({
  children,
  className,
  onClick,
  title,
  subtitle,
  badge,
  meta,
  actions,
  accentColor = "border-l-indigo-500",
}: Readonly<MobileEntityCardProps>) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col rounded-xl border border-slate-200/70 bg-white shadow-sm",
        "text-left text-sm",
        "border-l-4",
        accentColor,
        onClick && "cursor-pointer transition-all duration-150 hover:shadow-md hover:border-slate-300",
        className,
      )}
    >
      {/* Header row */}
      {title || badge ? (
        <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
          <div className="min-w-0 flex-1">
            {title ? (
              <p className="truncate text-[15px] font-bold text-slate-900">
                {title}
              </p>
            ) : null}
            {subtitle ? (
              <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                {subtitle}
              </p>
            ) : null}
          </div>
          {badge ? <div className="shrink-0 ml-2">{badge}</div> : null}
        </div>
      ) : null}

      {/* Meta grid area — clean label-value rows */}
      {meta ? (
        <div className="px-4 pb-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {meta}
          </div>
        </div>
      ) : null}

      {/* Children (custom content) */}
      {children ? (
        <div className="px-4 pb-2 text-xs text-slate-600">
          {children}
        </div>
      ) : null}

      {/* Actions with divider */}
      {actions ? (
        <div className="border-t border-slate-100 px-4 py-3">
          {actions}
        </div>
      ) : null}
    </Component>
  );
}
