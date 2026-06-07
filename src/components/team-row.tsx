"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(disabled ? {} : listeners)}
      className={cn(
        "list-none w-full select-none",
        !disabled && "cursor-grab active:cursor-grabbing",
        disabled && "cursor-default",
        isDragging && "opacity-50 z-50",
      )}
    >
      <TeamBadge
        team={team}
        eliminated={eliminated}
        matched={matched}
        size={size}
        showGrip={!disabled}
        border={false}
      />
    </div>
  );
}
