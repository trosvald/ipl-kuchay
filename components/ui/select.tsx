"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "flex h-9 w-[200px] items-center justify-between whitespace-nowrap rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function SelectContent({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function SelectItem({ children, value, ...props }: { children?: ReactNode; value: string } & React.OptionHTMLAttributes<HTMLOptionElement>) {
  return <option value={value} {...props}>{children}</option>;
}

export function SelectTrigger({ children, className, ...props }: SelectProps) {
  return (
    <Select className={className} {...props}>
      {children}
    </Select>
  );
}

export function SelectValue({ children, placeholder }: { children?: ReactNode; placeholder?: string }) {
  return <span>{children || placeholder}</span>;
}