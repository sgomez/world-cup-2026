import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BannerProps {
  variant?: "info" | "warning";
  children: ReactNode;
  className?: string;
}

const variantClasses = {
  info: "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/5 dark:bg-slate-900/40 dark:text-slate-400",
  warning:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400",
};

export function Banner({ variant = "info", children, className }: BannerProps) {
  return (
    <div
      className={cn(
        "rounded-xl border px-6 py-4 text-center text-sm font-medium",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
