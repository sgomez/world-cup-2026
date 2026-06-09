import { KNOCKOUT_MATCH_IDS, type KnockoutMatch } from "./bracket-core";

export interface ScoreableContent {
  R32: Set<string>;
  R16: Set<string>;
  QF: Set<string>;
  SF: Set<string>;
  F: Set<string>;
  champion: string | null;
  thirdPlace: string | null;
}

/**
 * Extracts the scoreable content from a knockout match map.
 * This includes the set of teams reaching each knockout round (R32, R16, QF, SF, F)
 * plus the champion and third-place winner.
 */
export function extractScoreableContent(
  knockoutMatches: Record<string, KnockoutMatch>,
): ScoreableContent {
  const R32 = new Set<string>();
  const R16 = new Set<string>();
  const QF = new Set<string>();
  const SF = new Set<string>();
  const F = new Set<string>();

  const rounds = { R32, R16, QF, SF, F };

  for (const round of ["R32", "R16", "QF", "SF", "F"] as const) {
    const ids = KNOCKOUT_MATCH_IDS[round];
    if (ids) {
      for (const matchId of ids) {
        const match = knockoutMatches[matchId];
        if (match?.team1Id) {
          rounds[round].add(match.team1Id.toUpperCase());
        }
        if (match?.team2Id) {
          rounds[round].add(match.team2Id.toUpperCase());
        }
      }
    }
  }

  const champion = knockoutMatches.F?.winnerId?.toUpperCase() || null;
  const thirdPlace = knockoutMatches["3RD"]?.winnerId?.toUpperCase() || null;

  return {
    R32,
    R16,
    QF,
    SF,
    F,
    champion,
    thirdPlace,
  };
}
