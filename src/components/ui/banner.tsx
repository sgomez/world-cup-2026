import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BannerProps {
  variant?: "info" | "warning";
  children: ReactNode;
  className?: string;
}

const variantClasses = {
  info: "border-hairline bg-soft-cloud text-foreground dark:bg-charcoal dark:border-ash",
  warning: "border-sale/30 bg-sale/5 text-sale dark:border-sale-deep/30",
};

export function Banner({ variant = "info", children, className }: BannerProps) {
  return (
    <div
      className={cn(
        "rounded-none border px-6 py-4 text-center text-caption-md font-medium",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
