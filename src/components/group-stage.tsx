"use client";

import { type Dispatch, useMemo } from "react";
import { TeamClassification } from "@/components/team-classification";
import {
  getOrderedThirdPlaceTeams,
  type PredictionAction,
  type PredictionState,
} from "@/lib/prediction-state";
import { type GroupData, groups } from "@/lib/teams";

function getGroupTeamsOrdered(state: PredictionState, groupLetter: string) {
  const group = groups.find((g) => g.group === groupLetter);
  if (!group) return [];
  const orderedIds =
    state.groupOrders[groupLetter] ?? group.teams.map((t) => t.id);
  const byId = new Map(group.teams.map((t) => [t.id, t]));
  return orderedIds
    .map((id) => byId.get(id))
    .filter(Boolean) as typeof group.teams;
}

function GroupCard({
  group,
  state,
  onOrderChange,
}: {
  group: GroupData;
  state: PredictionState;
  onOrderChange: (orderedIds: string[]) => void;
}) {
  const orderedTeams = useMemo(
    () => getGroupTeamsOrdered(state, group.group),
    [state, group.group],
  );

  return (
    <div className="rounded-xl border border-white/5 bg-slate-900/60 px-3 pb-3 pt-2">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Group {group.group}
      </p>
      <TeamClassification
        teams={orderedTeams}
        qualifiedCount={2}
        onOrderChange={onOrderChange}
      />
    </div>
  );
}

export function GroupStage({
  state,
  dispatch,
}: {
  state: PredictionState;
  dispatch: Dispatch<PredictionAction>;
}) {
  const orderedThirdPlaceTeams = useMemo(
    () => getOrderedThirdPlaceTeams(state),
    [state],
  );

  return (
    <div className="space-y-6">
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))" }}
      >
        {groups.map((group) => (
          <GroupCard
            key={group.group}
            group={group}
            state={state}
            onOrderChange={(orderedIds) =>
              dispatch({
                type: "SET_GROUP_ORDER",
                groupName: group.group,
                orderedIds,
              })
            }
          />
        ))}
      </div>

      <div className="rounded-xl border border-white/5 bg-slate-900/60 px-3 pb-3 pt-2">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Best 3rd Place Teams
        </p>
        <p className="mb-3 text-[11px] text-slate-500">
          Top 8 qualify — drag to rank
        </p>
        <TeamClassification
          key={orderedThirdPlaceTeams.map((t) => t.originalId).join(",")}
          teams={orderedThirdPlaceTeams}
          qualifiedCount={8}
          dividerAfter={8}
          onOrderChange={(orderedIds) =>
            dispatch({ type: "SET_THIRD_PLACE_ORDER", orderedIds })
          }
        />
      </div>
    </div>
  );
}
