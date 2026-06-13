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
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { TeamRow } from "@/components/team-row";
import type { Team } from "@/modules/teams";

export type GroupCardProps = {
  id?: string;
  title: string;
  teams: Team[];
  qualify?: number; // default 2
  onOrderChange?: (orderedIds: string[]) => void;
  disabled?: boolean;
};

export function GroupCard({
  id,
  title,
  teams,
  qualify = 2,
  onOrderChange,
  disabled = false,
}: GroupCardProps) {
  const t = useTranslations("groupStage");
  const fallbackId = useId();
  const dndContextId = id || fallbackId;

  const [localTeams, setLocalTeams] = useState<Team[]>(teams);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [prevTeamsKey, setPrevTeamsKey] = useState<string>(() =>
    teams.map((t) => `${t.id}:${t.code}`).join(","),
  );

  // Keep local state in sync when external teams prop changes
  const currentTeamsKey = teams.map((t) => `${t.id}:${t.code}`).join(",");
  if (currentTeamsKey !== prevTeamsKey) {
    setPrevTeamsKey(currentTeamsKey);
    setLocalTeams(teams);
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (disabled) return;
    if (over && active.id !== over.id) {
      const oldIndex = localTeams.findIndex((t) => t.id === active.id);
      const newIndex = localTeams.findIndex((t) => t.id === over.id);
      const next = arrayMove(localTeams, oldIndex, newIndex);
      setLocalTeams(next);
      if (onOrderChange) {
        onOrderChange(next.map((t) => t.id));
      }
    }
  }

  const activeTeam = activeId
    ? localTeams.find((t) => t.id === activeId)
    : null;

  return (
    <div className="rounded-md border border-hairline bg-canvas p-3 dark:border-ash dark:bg-ink">
      {/* Header with Title and Qualifier Badge */}
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-hairline pb-2 dark:border-ash">
        <span className="font-[family-name:var(--font-oswald)] text-xs font-bold uppercase tracking-wider text-ink dark:text-canvas">
          {title}
        </span>
        <span className="rounded-full bg-soft-cloud px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-mute dark:bg-charcoal dark:text-stone">
          {t("qualifies", { qualify, total: teams.length })}
        </span>
      </div>

      {/* Sortable List */}
      <DndContext
        id={dndContextId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext
          items={localTeams}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-1.5 p-0 m-0">
            {localTeams.map((team, index) => {
              const isEliminated = index >= qualify;
              return (
                <div key={team.id}>
                  {index === qualify && (
                    <div className="my-2 flex items-center gap-2 select-none">
                      <div className="h-px flex-1 bg-sale/30 dark:bg-sale/20" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sale dark:text-sale">
                        {t("cut")}
                      </span>
                      <div className="h-px flex-1 bg-sale/30 dark:bg-sale/20" />
                    </div>
                  )}
                  <TeamRow
                    team={team}
                    eliminated={isEliminated}
                    disabled={disabled}
                  />
                </div>
              );
            })}
          </div>
        </SortableContext>
        <DragOverlay
          dropAnimation={{
            duration: 250,
            easing: "cubic-bezier(0.25, 1, 0.5, 1)",
          }}
        >
          {activeTeam ? (
            <div className="w-full pointer-events-none opacity-80 ring-2 ring-ink/30 dark:ring-canvas/30 rounded-md">
              <TeamRow team={activeTeam} disabled />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
