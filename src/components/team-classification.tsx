"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
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
import { GripVertical } from "lucide-react";
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
}: {
  team: SortableTeam;
  isQualified: boolean;
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
    transition: { duration: 250, easing: "cubic-bezier(0.25, 1, 0.5, 1)" },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        "flex flex-1 cursor-grab touch-none items-center gap-2 rounded border px-2 py-1.5 text-sm",
        "transition-[box-shadow,opacity,background-color] duration-200",
        "hover:shadow-sm active:cursor-grabbing",
        isDragging && "z-50 opacity-40",
        isQualified
          ? "border-emerald-700/50 bg-emerald-950/40 text-white"
          : "border-white/5 bg-slate-900/40 text-slate-500",
      )}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-600" />
      <span
        role="img"
        aria-label={`${team.name} flag`}
        className="text-base leading-none"
      >
        {team.flag}
      </span>
      <span className="flex-1 truncate text-xs">{team.name}</span>
    </div>
  );
}

function TeamRowOverlay({ team }: { team: SortableTeam }) {
  return (
    <div className="flex cursor-grabbing items-center gap-2 rounded border border-emerald-500 bg-slate-800 px-2 py-1.5 text-sm shadow-xl ring-1 ring-emerald-500/50">
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span
        role="img"
        aria-label={`${team.name} flag`}
        className="text-base leading-none"
      >
        {team.flag}
      </span>
      <span className="flex-1 truncate text-xs text-white">{team.name}</span>
    </div>
  );
}

export function TeamClassification({
  teams: initialTeams,
  qualifiedCount,
  dividerAfter,
  onOrderChange,
}: {
  teams: SortableTeam[];
  qualifiedCount: number;
  dividerAfter?: number;
  onOrderChange: (orderedIds: string[]) => void;
}) {
  const [teams, setTeams] = useState(initialTeams);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
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
    if (over && active.id !== over.id) {
      setTeams((items) => {
        const oldIndex = items.findIndex((t) => t.id === active.id);
        const newIndex = items.findIndex((t) => t.id === over.id);
        const next = arrayMove(items, oldIndex, newIndex);
        onOrderChange(next.map((t) => t.id));
        return next;
      });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={teams} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1">
          {teams.map((team, index) => (
            <div key={team.id}>
              {dividerAfter !== undefined && index === dividerAfter && (
                <div className="my-1.5 flex items-center gap-2">
                  <div className="h-px flex-1 bg-rose-700/50" />
                  <span className="text-[10px] font-medium text-rose-400 uppercase tracking-wider">
                    eliminated
                  </span>
                  <div className="h-px flex-1 bg-rose-700/50" />
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="w-4 shrink-0 text-center text-[10px] text-slate-600">
                  {index + 1}
                </span>
                <SortableTeamRow
                  team={team}
                  isQualified={index < qualifiedCount}
                />
              </div>
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
