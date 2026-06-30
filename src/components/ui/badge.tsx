"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";

export type BadgePlacement =
  | "top-right"
  | "top-left"
  | "bottom-right"
  | "bottom-left";

export type BadgeColor = "default" | "success";

export type BadgeSize = "sm" | "md" | "lg";

export type BadgeProps = {
  placement?: BadgePlacement;
  color?: BadgeColor;
  size?: BadgeSize;
  children?: React.ReactNode;
};

const placementClasses: Record<BadgePlacement, string> = {
  "top-right": "top-0 right-0 -translate-y-1/2 translate-x-1/2",
  "top-left": "top-0 left-0 -translate-y-1/2 -translate-x-1/2",
  "bottom-right": "bottom-0 right-0 translate-y-1/2 translate-x-1/2",
  "bottom-left": "bottom-0 left-0 translate-y-1/2 -translate-x-1/2",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "text-[10px] leading-none py-px px-1 rounded-full min-w-4",
  md: "text-caption-sm leading-none py-0.5 px-1.5 rounded-full min-w-[18px]",
  lg: "text-caption-md leading-none py-0.5 px-2 rounded-full min-w-[22px]",
};

const colorClasses: Record<BadgeColor, string> = {
  default:
    "bg-soft-cloud dark:bg-charcoal text-ink dark:text-canvas border border-hairline dark:border-ash",
  success:
    "bg-success/10 dark:bg-success-bright/10 text-success dark:text-success-bright border border-success/30 dark:border-success-bright/30",
};

function BadgeLabel({ children }: { children: React.ReactNode }) {
  return <span>{children}</span>;
}

function BadgeAnchor({ children }: { children: React.ReactNode }) {
  return <div className="relative inline-block">{children}</div>;
}

export function Badge({
  placement = "top-right",
  color = "default",
  size = "md",
  children,
}: BadgeProps) {
  if (children === null || children === undefined) return null;

  const content =
    typeof children === "string" || typeof children === "number" ? (
      <BadgeLabel>{children}</BadgeLabel>
    ) : (
      children
    );

  return (
    <span
      className={cn(
        "absolute inline-flex items-center justify-center font-medium whitespace-nowrap",
        placementClasses[placement],
        sizeClasses[size],
        colorClasses[color],
      )}
    >
      {content}
    </span>
  );
}

Badge.Label = BadgeLabel;
Badge.Anchor = BadgeAnchor;
