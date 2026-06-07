"use client";

import { useLocale, useTranslations } from "next-intl";
import { type Dispatch, useMemo } from "react";
import { GroupCard } from "@/components/group-card";
import {
  getOrderedThirdPlaceTeams,
  type TournamentAction,
  type TournamentState,
} from "@/lib/prediction-state";
import { getGroups, type Team } from "@/lib/teams";

function getGroupTeamsOrdered(
  state: TournamentState,
  groupLetter: string,
  locale: string,
) {
  const group = getGroups(locale).find((g) => g.group === groupLetter);
  if (!group) return [];
  const orderedIds =
    state.groupOrders[groupLetter] ?? group.teams.map((t) => t.id);
  const byId = new Map(group.teams.map((t) => [t.id, t]));
  return orderedIds
    .map((id) => byId.get(id))
    .filter(Boolean) as typeof group.teams;
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
  const t = useTranslations("groupStage");
  const locale = useLocale();
  const orderedThirdPlaceTeams = useMemo(
    () => getOrderedThirdPlaceTeams(state, locale),
    [state, locale],
  );

  return (
    <div className="flex flex-col gap-4 min-[640px]:flex-row">
      <div className="order-1 min-w-0 flex-1 min-[640px]:order-none">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {getGroups(locale).map((group) => {
            const orderedTeams = getGroupTeamsOrdered(
              state,
              group.group,
              locale,
            );
            return (
              <GroupCard
                key={group.group}
                id={`group-${group.group}`}
                title={t("group", { letter: group.group })}
                teams={orderedTeams}
                qualify={2}
                disabled={readOnly}
                onOrderChange={(orderedIds) =>
                  dispatch({
                    type: "SET_GROUP_ORDER",
                    groupName: group.group,
                    orderedIds,
                  })
                }
              />
            );
          })}
        </div>
      </div>

      <div className="order-2 w-full min-[640px]:order-none min-[640px]:w-[240px] min-[640px]:shrink-0">
        <GroupCard
          id="third-place"
          key={orderedThirdPlaceTeams.map((t) => t.originalId).join(",")}
          title={t("bestThirdPlace")}
          teams={orderedThirdPlaceTeams as Team[]}
          qualify={8}
          disabled={readOnly}
          onOrderChange={(orderedIds) =>
            dispatch({ type: "SET_THIRD_PLACE_ORDER", orderedIds })
          }
        />
      </div>
    </div>
  );
}
