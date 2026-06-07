"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { TeamBadge } from "@/components/team-badge";
import type { Team } from "@/lib/teams";
import { cn } from "@/lib/utils";

export type TeamRowProps = {
  team: Team;
  eliminated?: boolean;
  matched?: boolean;
  disabled?: boolean;
  size?: "default" | "compact";
};

export function TeamRow({
  team,
  eliminated = false,
  matched = false,
  disabled = false,
  size = "default",
}: TeamRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: team.id,
    disabled,
    transition: { duration: 250, easing: "cubic-bezier(0.25, 1, 0.5, 1)" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(disabled ? {} : listeners)}
      className={cn(
        "flex items-center gap-2 list-none w-full select-none",
        !disabled &&
          "cursor-grab active:cursor-grabbing hover:bg-slate-50 dark:hover:bg-slate-900/40 rounded-md transition-colors",
        disabled && "cursor-default",
        isDragging && "opacity-50 z-50",
      )}
    >
      <div className="flex-1 min-w-0">
        <TeamBadge
          team={team}
          eliminated={eliminated}
          matched={matched}
          size={size}
        />
      </div>
      <div className="flex items-center justify-center shrink-0 w-6 h-6">
        <GripVertical
          className={cn(
            "h-4 w-4 text-mute dark:text-stone transition-opacity",
            disabled ? "opacity-20" : "opacity-70 group-hover:opacity-100",
          )}
        />
      </div>
    </li>
  );
}
