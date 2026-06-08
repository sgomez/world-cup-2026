import { createHash } from "crypto";
import {
  createInitialState,
  KNOCKOUT_MATCH_IDS,
  type PredictionState,
} from "./prediction-state";

const SCOREABLE_ROUNDS = ["R32", "R16", "QF", "SF", "F"] as const;

export function computeBetSignature(
  groupPredictions: PredictionState | null,
  knockoutWinners: Record<string, string> | null,
): string {
  const { knockoutMatches } = createInitialState(
    groupPredictions,
    knockoutWinners,
  );

  const parts: string[] = [];

  for (const round of SCOREABLE_ROUNDS) {
    const teamIds = new Set<string>();
    for (const matchId of KNOCKOUT_MATCH_IDS[round]) {
      const match = knockoutMatches[matchId];
      if (match?.team1Id) teamIds.add(match.team1Id.toUpperCase());
      if (match?.team2Id) teamIds.add(match.team2Id.toUpperCase());
    }
    parts.push(`${round}:${[...teamIds].sort().join(",")}`);
  }

  const champion = knockoutMatches["F"]?.winnerId;
  parts.push(`C:${champion ? champion.toUpperCase() : ""}`);

  const thirdWinner = knockoutMatches["3RD"]?.winnerId;
  parts.push(`3RD:${thirdWinner ? thirdWinner.toUpperCase() : ""}`);

  return createHash("sha256").update(parts.join("|")).digest("hex");
}
