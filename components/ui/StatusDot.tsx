import { cn } from "@/lib/utils";

export interface StatusDotProps {
  variant?: "success" | "warning" | "destructive" | "default" | "muted";
  className?: string;
  pulse?: boolean;
}

const dotVariants: Record<string, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  destructive: "bg-red-500",
  default: "bg-indigo-500",
  muted: "bg-slate-300",
};

/**
 * Small colored status dot for inline status indicators.
 * Use in place of full badges for compact row layouts.
 */
export function StatusDot({
  variant = "default",
  className,
  pulse = false,
}: Readonly<StatusDotProps>) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        dotVariants[variant],
        pulse && "animate-pulse",
        className,
      )}
    />
  );
}
