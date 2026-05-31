import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface DataListProps {
  /** Loading state — shows skeleton placeholders */
  loading?: boolean;
  /** Number of skeleton rows to show while loading */
  skeletonCount?: number;
  /** Empty state — shown when loading is done and items are empty */
  empty?: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
  };
  /** Error state — overrides both loading and empty */
  error?: string | null;
  /** Called to retry after an error */
  onRetry?: () => void;
  /** Mobile card renderer (shown below lg breakpoint) */
  mobile?: ReactNode;
  /** Desktop table/content renderer (shown at lg breakpoint and above) */
  desktop?: ReactNode;
  /** Wrapper class */
  className?: string;
}

/**
 * Unifies loading / empty / error / mobile-render / desktop-render patterns
 * common across admin list pages.
 *
 * Renders nothing until `loading` is false and items exist — then shows
 * mobile cards (below `lg`) and desktop content (at `lg` and above).
 */
export function DataList({
  loading = false,
  skeletonCount = 4,
  empty,
  error = null,
  onRetry,
  mobile,
  desktop,
  className,
}: Readonly<DataListProps>) {
  /* ── Error state ── */
  if (error) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="rounded-lg border border-red-200 bg-red-50/80 px-4 py-3.5 text-sm text-red-700">
          <p className="font-medium">{error}</p>
        </div>
        {onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry} className="gap-1.5">
            <RefreshCw className="size-3.5" /> Coba lagi
          </Button>
        ) : null}
      </div>
    );
  }

  /* ── Loading state ── */
  if (loading) {
    const skeletonItems = Array.from({ length: skeletonCount }, (_, idx) => idx);
    return (
      <div className={cn("space-y-3", className)}>
        {skeletonItems.map((n) => (
          <Skeleton key={`skel-${n}`} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  /* ── Empty state ── */
  if (!loading && !error) {
    const noContent = !mobile && !desktop;

    /* If no explicit mobile/desktop content was provided, assume empty */
    if (noContent && empty) {
      return (
        <EmptyState
          icon={empty.icon}
          title={empty.title}
          description={empty.description}
          action={empty.action}
          className={className}
        />
      );
    }
  }

  /* ── Content state ── */
  return (
    <div className={cn(className)}>
      {/* Mobile cards */}
      {mobile ? (
        <div className="space-y-3 lg:hidden">{mobile}</div>
      ) : null}

      {/* Desktop content */}
      {desktop ? (
        <div className="hidden lg:block">{desktop}</div>
      ) : null}
    </div>
  );
}
