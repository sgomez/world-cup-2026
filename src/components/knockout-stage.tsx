"use client";

import type { Dispatch } from "react";
import type { TournamentState } from "@/modules/bracket";
import type { TournamentAction } from "@/modules/bracket/prediction-ui";
import { KnockoutBracket, MatchTeamRow } from "./knockout-bracket";

// Re-export MatchTeamRow to keep the existing unit test green
export { MatchTeamRow };

export function KnockoutStage({
  state,
  dispatch,
  readOnly = false,
}: {
  state: TournamentState;
  dispatch: Dispatch<TournamentAction>;
  readOnly?: boolean;
}) {
  return (
    <KnockoutBracket
      mode="editable"
      state={state}
      dispatch={dispatch}
      readOnly={readOnly}
    />
  );
}
