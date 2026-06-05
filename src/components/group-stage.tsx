"use client";

import { type Dispatch, useMemo } from "react";
import { TeamClassification } from "@/components/team-classification";
import {
  getOrderedThirdPlaceTeams,
  type TournamentAction,
  type TournamentState,
} from "@/lib/prediction-state";
import { type GroupData, groups } from "@/lib/teams";

function getGroupTeamsOrdered(state: TournamentState, groupLetter: string) {
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
  readOnly,
}: {
  group: GroupData;
  state: TournamentState;
  onOrderChange: (orderedIds: string[]) => void;
  readOnly: boolean;
}) {
  const orderedTeams = useMemo(
    () => getGroupTeamsOrdered(state, group.group),
    [state, group.group],
  );

  return (
    <div className="rounded-xl bg-white/80 p-3 shadow-lg dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900">
      <div className="mb-2 flex items-center gap-2">
        <div className="h-4 w-1 rounded-full bg-cyan-500 dark:bg-cyan-400" />
        <p className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">
          Group {group.group}
        </p>
      </div>
      <TeamClassification
        id={`group-${group.group}`}
        teams={orderedTeams}
        qualifiedCount={2}
        onOrderChange={onOrderChange}
        disabled={readOnly}
      />
    </div>
  );
}

export function GroupStage({
  state,
  dispatch,
  readOnly = false,
}: {
  state: TournamentState;
  dispatch: Dispatch<TournamentAction>;
  readOnly?: boolean;
}) {
  const orderedThirdPlaceTeams = useMemo(
    () => getOrderedThirdPlaceTeams(state),
    [state],
  );

  return (
    <div className="flex flex-col gap-4 min-[640px]:flex-row">
      <div className="order-1 min-w-0 flex-1 min-[640px]:order-none">
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          }}
        >
          {groups.map((group) => (
            <GroupCard
              key={group.group}
              group={group}
              state={state}
              readOnly={readOnly}
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
      </div>

      <div className="order-2 w-full min-[640px]:order-none min-[640px]:w-[200px] min-[640px]:shrink-0">
        <div className="rounded-xl bg-white/80 p-3 shadow-lg dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-4 w-1 rounded-full bg-amber-500" />
            <p className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-amber-400">
              Best 3rd Place
            </p>
          </div>
          <p className="mb-3 text-[10px] text-slate-500 dark:text-slate-400">
            Top 8 of 12 qualify
          </p>
          <TeamClassification
            id="third-place"
            key={orderedThirdPlaceTeams.map((t) => t.originalId).join(",")}
            teams={orderedThirdPlaceTeams}
            qualifiedCount={8}
            dividerAfter={8}
            onOrderChange={(orderedIds) =>
              dispatch({ type: "SET_THIRD_PLACE_ORDER", orderedIds })
            }
            disabled={readOnly}
          />
        </div>
      </div>
    </div>
  );
}
