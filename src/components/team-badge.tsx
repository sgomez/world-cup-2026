"use client";

import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Team } from "@/modules/teams";

export type TeamBadgeProps = {
  team: Team;
  eliminated?: boolean;
  matched?: boolean;
  size?: "default" | "compact";
  showGrip?: boolean;
  rightAddon?: React.ReactNode;
  border?: boolean;
};

export function TeamBadge({
  team,
  eliminated = false,
  matched = false,
  size = "default",
  showGrip = false,
  rightAddon,
  border = true,
}: TeamBadgeProps) {
  const flagUrl = `https://flagcdn.com/w320/${team.code.toLowerCase()}.png`;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md transition-all duration-200 flex items-center select-none w-full",
        border && "border",
        // Sizes
        size === "default" ? "h-11 px-4 py-2" : "h-8 px-3 py-1",
        // Matched state (green tint)
        matched
          ? cn(
              "bg-success/10 text-success dark:bg-success-bright/10 dark:text-success-bright",
              border && "border-success/30 dark:border-success-bright/30",
            )
          : cn(
              "bg-canvas/80 text-ink dark:bg-ink/80 dark:text-canvas",
              border && "border-hairline dark:border-ash",
            ),
        // Grayscale / Eliminated state
        eliminated && "grayscale opacity-50",
      )}
    >
      {/* Flag Background */}
      <div
        className="absolute inset-y-0 left-0 w-2/3 pointer-events-none transition-all duration-200"
        style={{
          backgroundImage: `url(${flagUrl})`,
          backgroundPosition: "left center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          WebkitMaskImage:
            "linear-gradient(to right, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0) 100%)",
          maskImage:
            "linear-gradient(to right, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex items-center justify-between w-full gap-2">
        <span
          className={cn(
            "font-[family-name:var(--font-oswald)] uppercase tracking-wider font-semibold truncate min-w-0",
            size === "default" ? "text-sm" : "text-xs",
          )}
        >
          {team.name}
        </span>
        {showGrip && (
          <GripVertical className="h-4 w-4 shrink-0 text-mute dark:text-stone opacity-70" />
        )}
        {rightAddon}
      </div>
    </div>
  );
}
