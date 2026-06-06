"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type SortableTeam = {
  id: string;
  name: string;
  flag: string;
};

function SortableTeamRow({
  team,
  isQualified,
  disabled,
}: {
  team: SortableTeam;
  isQualified: boolean;
  disabled: boolean;
}) {
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

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...(disabled ? {} : listeners)}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-2.5 transition-all duration-200 sm:py-1.5",
        !disabled &&
          "cursor-grab hover:bg-slate-200/50 active:cursor-grabbing dark:hover:bg-white/10",
        disabled && "cursor-default",
        isDragging && "z-50 opacity-50",
        !isQualified && "opacity-40",
      )}
    >
      <span
        role="img"
        aria-label={`${team.name} flag`}
        className="shrink-0 text-xl leading-none sm:text-base"
      >
        {team.flag}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-bold tracking-tight sm:text-xs",
          isQualified
            ? "text-slate-900 dark:text-white"
            : "text-slate-400 dark:text-slate-500",
        )}
      >
        {team.name}
      </span>
    </div>
  );
}

function TeamRowOverlay({ team }: { team: SortableTeam }) {
  return (
    <div className="flex cursor-grabbing items-center gap-2 rounded-md bg-white px-2 py-1.5 shadow-xl ring-2 ring-cyan-500 dark:bg-slate-700 dark:ring-cyan-400">
      <span
        role="img"
        aria-label={`${team.name} flag`}
        className="shrink-0 text-base leading-none"
      >
        {team.flag}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-bold tracking-tight text-slate-900 dark:text-white">
        {team.name}
      </span>
    </div>
  );
}

export function TeamClassification({
  id,
  teams: initialTeams,
  qualifiedCount,
  dividerAfter,
  onOrderChange,
  disabled = false,
}: {
  id: string;
  teams: SortableTeam[];
  qualifiedCount: number;
  dividerAfter?: number;
  onOrderChange: (orderedIds: string[]) => void;
  disabled?: boolean;
}) {
  const [teams, setTeams] = useState(initialTeams);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const activeTeam = activeId ? teams.find((t) => t.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (disabled) return;
    if (over && active.id !== over.id) {
      const oldIndex = teams.findIndex((t) => t.id === active.id);
      const newIndex = teams.findIndex((t) => t.id === over.id);
      const next = arrayMove(teams, oldIndex, newIndex);
      setTeams(next);
      onOrderChange(next.map((t) => t.id));
    }
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={teams} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col">
          {teams.map((team, index) => (
            <div key={team.id}>
              {dividerAfter !== undefined && index === dividerAfter && (
                <div className="my-1.5 flex items-center gap-2">
                  <div className="h-px flex-1 bg-rose-300 dark:bg-rose-700/50" />
                  <span className="text-[10px] font-medium uppercase tracking-wider text-rose-500 dark:text-rose-400">
                    eliminated
                  </span>
                  <div className="h-px flex-1 bg-rose-300 dark:bg-rose-700/50" />
                </div>
              )}
              <SortableTeamRow
                team={team}
                isQualified={index < qualifiedCount}
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      </SortableContext>
      <DragOverlay
        dropAnimation={{
          duration: 250,
          easing: "cubic-bezier(0.25, 1, 0.5, 1)",
        }}
      >
        {activeTeam ? <TeamRowOverlay team={activeTeam} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
