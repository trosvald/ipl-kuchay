import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface StatItem {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  variant?: "default" | "success" | "warning" | "destructive";
}

export interface StatsGridProps {
  items: StatItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const accentTop: Record<string, string> = {
  default: "border-t-slate-300",
  success: "border-t-emerald-500",
  warning: "border-t-amber-500",
  destructive: "border-t-red-500",
};

const iconBg: Record<string, string> = {
  default: "bg-slate-100 text-slate-600",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  destructive: "bg-red-100 text-red-700",
};

const trendColors: Record<string, string> = {
  up: "text-emerald-600",
  down: "text-red-600",
  neutral: "text-slate-500",
};

export function StatsGrid({
  items,
  columns = 4,
  className,
}: Readonly<StatsGridProps>) {
  const gridCols: Record<number, string> = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {items.map((item) => {
        const variant = item.variant ?? "default";
        const Icon = item.icon;

        return (
          <div
            key={item.label}
            className={cn(
              "flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm",
              "border-t-4",
              accentTop[variant],
            )}
          >
            <div className="flex items-center justify-between">
              <span className="stat-label">{item.label}</span>
              {Icon ? (
                <div className={cn("flex size-8 items-center justify-center rounded-lg", iconBg[variant])}>
                  <Icon className="size-4" />
                </div>
              ) : null}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="stat-value">{item.value}</span>
              {item.trend ? (
                <span
                  className={cn(
                    "text-sm font-semibold",
                    trendColors[item.trend],
                  )}
                >
                  {item.trend === "up" ? "↑" : item.trend === "down" ? "↓" : "→"}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
