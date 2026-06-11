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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import {
  clearManualTieBreakAction,
  setManualTieBreakAction,
  setThirdPlaceManualOrderAction,
} from "@/app/actions/tournament";
import { TeamBadge } from "@/components/team-badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getTeamById, type Team } from "@/lib/teams";
import { cn } from "@/lib/utils";
import type { GroupTieInfo } from "@/modules/tournament/domain/derive-result";

// ---------------------------------------------------------------------------
// Sortable item — used inside a tied cluster (draggable)
// ---------------------------------------------------------------------------

function SortableTeamItem({
  team,
  isDragOverlay = false,
}: {
  team: Team;
  isDragOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: team.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "flex cursor-grab items-center gap-2 rounded-lg border border-hairline bg-canvas px-2 py-1.5 shadow-sm select-none active:cursor-grabbing dark:border-ash dark:bg-ink",
        isDragging && !isDragOverlay && "opacity-40",
        isDragOverlay &&
          "shadow-lg border-info/40 bg-info/5 dark:border-info/30 dark:bg-info/10",
      )}
    >
      <GripVertical className="size-4 shrink-0 text-mute dark:text-stone" />
      <TeamBadge team={team} size="compact" border={false} showGrip={false} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pinned item — used outside a tied cluster (not draggable)
// ---------------------------------------------------------------------------

function PinnedTeamItem({ team }: { team: Team }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-hairline/40 bg-soft-cloud/50 px-2 py-1.5 select-none dark:border-ash/40 dark:bg-charcoal/30">
      <Lock className="size-3.5 shrink-0 text-hairline dark:text-ash" />
      <TeamBadge team={team} size="compact" border={false} showGrip={false} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-group tie-break sub-panel
// ---------------------------------------------------------------------------

type GroupTieBreakProps = {
  groupLetter: string;
  info: GroupTieInfo;
  locale: string;
  existingManualOrder: string[] | undefined;
};

function GroupTieBreakPanel({
  groupLetter,
  info,
  locale,
  existingManualOrder,
}: GroupTieBreakProps) {
  const t = useTranslations("adminTieBreak");
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const dndId = useId();

  // The tied cluster is the full group of IDs that remain tied (after points/h2h)
  // We join all tie clusters into one set for this group
  const tiedSet = new Set(info.tieClusters.flatMap((c) => c));

  // Determine the draggable order. Use existing manual order if present (restricted
  // to tied teams only), otherwise use the current derived standing as default.
  const tiedTeams = info.standing.filter((id) => tiedSet.has(id));
  const pinnedBeforeTied = info.standing.filter(
    (id, idx) =>
      !tiedSet.has(id) && idx < info.standing.findIndex((x) => tiedSet.has(x)),
  );
  const pinnedAfterTied = info.standing.filter(
    (id, idx) =>
      !tiedSet.has(id) &&
      idx > info.standing.findLastIndex((x) => tiedSet.has(x)),
  );

  const initialTiedOrder = (() => {
    if (existingManualOrder) {
      // Use existing manual order filtered to only teams in the current tied set
      const manualFiltered = existingManualOrder.filter((id) =>
        tiedSet.has(id),
      );
      // Add any tied teams not in the manual order at the end
      const manualSet = new Set(manualFiltered);
      const remaining = tiedTeams.filter((id) => !manualSet.has(id));
      return [...manualFiltered, ...remaining];
    }
    return tiedTeams;
  })();

  const [tiedOrder, setTiedOrder] = useState<string[]>(initialTiedOrder);
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

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      const oldIdx = tiedOrder.indexOf(active.id as string);
      const newIdx = tiedOrder.indexOf(over.id as string);
      setTiedOrder((prev) => arrayMove(prev, oldIdx, newIdx));
    }
  }

  function handleSave() {
    startTransition(async () => {
      // The full ordered list is pinnedBefore + tiedOrder + pinnedAfter
      const fullOrder = [...pinnedBeforeTied, ...tiedOrder, ...pinnedAfterTied];
      const result = await setManualTieBreakAction(groupLetter, fullOrder);
      if (result?.error) {
        toast(result.error, "error");
      } else {
        toast(t("savedSuccess"), "success");
      }
    });
  }

  function handleClear() {
    startTransition(async () => {
      const result = await clearManualTieBreakAction(groupLetter);
      if (result?.error) {
        toast(result.error, "error");
      } else {
        setTiedOrder(tiedTeams);
        toast(t("savedSuccess"), "success");
      }
    });
  }

  const allTiedItems = tiedOrder
    .map((id) => getTeamById(id, locale))
    .filter((t): t is Team => !!t);
  const activeTeam = activeId ? getTeamById(activeId, locale) : null;

  return (
    <div className="rounded-xl border border-hairline bg-canvas p-4 shadow-sm dark:border-ash dark:bg-ink">
      {/* Group header */}
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-hairline pb-2 dark:border-ash">
        <span className="font-[family-name:var(--font-oswald)] text-sm font-bold uppercase tracking-wider text-ink dark:text-canvas">
          {t("groupTieBreak", { group: groupLetter })}
        </span>
        {existingManualOrder && (
          <button
            type="button"
            onClick={handleClear}
            disabled={isPending}
            className="text-[10px] font-bold uppercase tracking-wider text-mute hover:text-sale dark:text-stone dark:hover:text-sale transition-colors"
          >
            {t("clearOrder")}
          </button>
        )}
      </div>

      {/* Pinned teams above tied cluster */}
      {pinnedBeforeTied.map((id) => {
        const team = getTeamById(id, locale);
        if (!team) return null;
        return (
          <div key={id} className="mb-1.5">
            <PinnedTeamItem team={team} />
          </div>
        );
      })}

      {/* Tied cluster — draggable */}
      {info.tieClusters.length > 0 && (
        <div className="my-2 rounded-lg border border-dashed border-info/40 bg-info/5 p-2 dark:border-info/30 dark:bg-info/10">
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-info">
            {t("tiedCluster")}
          </p>
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext
              items={tiedOrder}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-1">
                {allTiedItems.map((team) => (
                  <SortableTeamItem key={team.id} team={team} />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeTeam && (
                <SortableTeamItem team={activeTeam} isDragOverlay />
              )}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {/* Pinned teams below tied cluster */}
      {pinnedAfterTied.map((id) => {
        const team = getTeamById(id, locale);
        if (!team) return null;
        return (
          <div key={id} className="mt-1.5">
            <PinnedTeamItem team={team} />
          </div>
        );
      })}

      {/* Save button */}
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? t("saving") : t("saveOrder")}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thirds tie-break sub-panel
// ---------------------------------------------------------------------------

type ThirdsTieBreakProps = {
  tieClusters: string[][];
  currentOrder: string[];
  locale: string;
  existingManualOrder: string[] | null;
};

function ThirdsTieBreakPanel({
  tieClusters,
  currentOrder,
  locale,
  existingManualOrder,
}: ThirdsTieBreakProps) {
  const t = useTranslations("adminTieBreak");
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const dndId = useId();

  const tiedSet = new Set(tieClusters.flatMap((c) => c));

  const tiedTeams = currentOrder.filter((id) => tiedSet.has(id));
  const pinnedBeforeTied = currentOrder.filter(
    (id, idx) =>
      !tiedSet.has(id) && idx < currentOrder.findIndex((x) => tiedSet.has(x)),
  );
  const pinnedAfterTied = currentOrder.filter(
    (id, idx) =>
      !tiedSet.has(id) &&
      idx > currentOrder.findLastIndex((x) => tiedSet.has(x)),
  );

  const initialTiedOrder = (() => {
    if (existingManualOrder) {
      const filtered = existingManualOrder.filter((id) => tiedSet.has(id));
      const filteredSet = new Set(filtered);
      const remaining = tiedTeams.filter((id) => !filteredSet.has(id));
      return [...filtered, ...remaining];
    }
    return tiedTeams;
  })();

  const [tiedOrder, setTiedOrder] = useState<string[]>(initialTiedOrder);
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

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      const oldIdx = tiedOrder.indexOf(active.id as string);
      const newIdx = tiedOrder.indexOf(over.id as string);
      setTiedOrder((prev) => arrayMove(prev, oldIdx, newIdx));
    }
  }

  function handleSave() {
    startTransition(async () => {
      const fullOrder = [...pinnedBeforeTied, ...tiedOrder, ...pinnedAfterTied];
      const result = await setThirdPlaceManualOrderAction(fullOrder);
      if (result?.error) {
        toast(result.error, "error");
      } else {
        toast(t("savedSuccess"), "success");
      }
    });
  }

  function handleClear() {
    startTransition(async () => {
      const result = await setThirdPlaceManualOrderAction(null);
      if (result?.error) {
        toast(result.error, "error");
      } else {
        setTiedOrder(tiedTeams);
        toast(t("savedSuccess"), "success");
      }
    });
  }

  // Convert team IDs (thirds are stored as group-letter IDs like "esp")
  // to Team objects via locale lookup
  const activeTeam = activeId ? getTeamById(activeId, locale) : null;

  return (
    <div className="rounded-xl border border-hairline bg-canvas p-4 shadow-sm dark:border-ash dark:bg-ink">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-hairline pb-2 dark:border-ash">
        <span className="font-[family-name:var(--font-oswald)] text-sm font-bold uppercase tracking-wider text-ink dark:text-canvas">
          {t("thirdsTieBreak")}
        </span>
        {existingManualOrder && (
          <button
            type="button"
            onClick={handleClear}
            disabled={isPending}
            className="text-[10px] font-bold uppercase tracking-wider text-mute hover:text-sale dark:text-stone dark:hover:text-sale transition-colors"
          >
            {t("clearOrder")}
          </button>
        )}
      </div>

      {/* Pinned before tied */}
      {pinnedBeforeTied.map((id) => {
        const team = getTeamById(id, locale);
        if (!team) return null;
        return (
          <div key={id} className="mb-1.5">
            <PinnedTeamItem team={team} />
          </div>
        );
      })}

      {/* Tied cluster */}
      {tieClusters.length > 0 && (
        <div className="my-2 rounded-lg border border-dashed border-info/40 bg-info/5 p-2 dark:border-info/30 dark:bg-info/10">
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-info">
            {t("tiedCluster")}
          </p>
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext
              items={tiedOrder}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-1">
                {tiedOrder.map((id) => {
                  const team = getTeamById(id, locale);
                  if (!team) return null;
                  return <SortableTeamItem key={id} team={team} />;
                })}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeTeam && (
                <SortableTeamItem team={activeTeam} isDragOverlay />
              )}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {/* Pinned after tied */}
      {pinnedAfterTied.map((id) => {
        const team = getTeamById(id, locale);
        if (!team) return null;
        return (
          <div key={id} className="mt-1.5">
            <PinnedTeamItem team={team} />
          </div>
        );
      })}

      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? t("saving") : t("saveOrder")}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export type AdminTieBreakPanelProps = {
  groupTieInfo: Record<string, GroupTieInfo>;
  thirdsTieClusters: string[][];
  /** Current thirds standing (derived, empty until all groups complete). */
  thirdsStanding: string[];
  manualTieBreaks: Record<string, string[]>;
  thirdPlaceManualOrder: string[] | null;
  locale: string;
};

/**
 * Admin tie-break ordering panel.
 *
 * Shows only groups with unresolved ties. Within each group, only the tied
 * cluster is draggable; separated teams are pinned. Persists via the
 * setManualTieBreakAction / setThirdPlaceManualOrderAction server actions.
 */
export function AdminTieBreakPanel({
  groupTieInfo,
  thirdsTieClusters,
  thirdsStanding,
  manualTieBreaks,
  thirdPlaceManualOrder,
  locale,
}: AdminTieBreakPanelProps) {
  const t = useTranslations("adminTieBreak");

  // Groups with at least one unresolved tie cluster
  const tiedGroups = Object.entries(groupTieInfo)
    .filter(([, info]) => info.tieClusters.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  const hasTies = tiedGroups.length > 0 || thirdsTieClusters.length > 0;

  if (!hasTies) {
    return (
      <div className="rounded-xl border border-hairline bg-canvas p-6 text-center shadow-sm dark:border-ash dark:bg-ink">
        <p className="text-caption-md text-mute dark:text-stone">
          {t("noTies")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-caption-md text-mute dark:text-stone">
        {t("description")}
      </p>

      {tiedGroups.map(([groupLetter, info]) => (
        <GroupTieBreakPanel
          key={groupLetter}
          groupLetter={groupLetter}
          info={info}
          locale={locale}
          existingManualOrder={manualTieBreaks[groupLetter]}
        />
      ))}

      {thirdsTieClusters.length > 0 && thirdsStanding.length > 0 && (
        <ThirdsTieBreakPanel
          tieClusters={thirdsTieClusters}
          currentOrder={thirdsStanding}
          locale={locale}
          existingManualOrder={thirdPlaceManualOrder}
        />
      )}
    </div>
  );
}
