import * as React from "react";

import { cn } from "@/lib/utils";

type DivProps = Readonly<React.HTMLAttributes<HTMLDivElement>>;
type ParagraphProps = Readonly<React.HTMLAttributes<HTMLParagraphElement>>;
type HeadingProps = Readonly<
  Omit<React.HTMLAttributes<HTMLHeadingElement>, "children"> & {
    children: React.ReactNode;
  }
>;

export function Card({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: DivProps) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}

export function CardTitle({ className, children, ...props }: HeadingProps) {
  return (
    <h3 className={cn("text-xl font-semibold leading-none tracking-tight", className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  ...props
}: ParagraphProps) {
  return <p className={cn("text-sm text-slate-600", className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: DivProps) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: DivProps) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}
