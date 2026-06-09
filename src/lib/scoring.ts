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

export interface ScoreableContentArrays {
  R32: string[];
  R16: string[];
  QF: string[];
  SF: string[];
  F: string[];
  champion: string | null;
  thirdPlace: string | null;
}

export const EMPTY_SCOREABLE_CONTENT_ARRAYS: ScoreableContentArrays = {
  R32: [],
  R16: [],
  QF: [],
  SF: [],
  F: [],
  champion: null,
  thirdPlace: null,
};

export const ROUND_POINTS: Record<string, number> = {
  R32: 3,
  R16: 4,
  QF: 5,
  SF: 6,
  F: 8,
};
export const THIRD_PLACE_POINTS = 5;
export const CHAMPION_POINTS = 10;

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

export function toScoreableContentArrays(
  content: ScoreableContent,
): ScoreableContentArrays {
  return {
    R32: Array.from(content.R32),
    R16: Array.from(content.R16),
    QF: Array.from(content.QF),
    SF: Array.from(content.SF),
    F: Array.from(content.F),
    champion: content.champion,
    thirdPlace: content.thirdPlace,
  };
}

export function toScoreableContent(
  arrays: ScoreableContentArrays,
): ScoreableContent {
  return {
    R32: new Set(arrays.R32.map((id) => id.toUpperCase())),
    R16: new Set(arrays.R16.map((id) => id.toUpperCase())),
    QF: new Set(arrays.QF.map((id) => id.toUpperCase())),
    SF: new Set(arrays.SF.map((id) => id.toUpperCase())),
    F: new Set(arrays.F.map((id) => id.toUpperCase())),
    champion: arrays.champion ? arrays.champion.toUpperCase() : null,
    thirdPlace: arrays.thirdPlace ? arrays.thirdPlace.toUpperCase() : null,
  };
}

export function scoreBet(
  betContent: ScoreableContent,
  answerKey: ScoreableContent,
): number {
  let score = 0;

  for (const round of ["R32", "R16", "QF", "SF", "F"] as const) {
    const points = ROUND_POINTS[round];
    if (points !== undefined) {
      const betRound = betContent[round];
      const answerRound = answerKey[round];

      let matchedCount = 0;
      for (const teamId of betRound) {
        if (answerRound.has(teamId)) {
          matchedCount++;
        }
      }
      score += matchedCount * points;
    }
  }

  if (
    betContent.champion &&
    answerKey.champion &&
    betContent.champion === answerKey.champion
  ) {
    score += CHAMPION_POINTS;
  }

  if (
    betContent.thirdPlace &&
    answerKey.thirdPlace &&
    betContent.thirdPlace === answerKey.thirdPlace
  ) {
    score += THIRD_PLACE_POINTS;
  }

  return score;
}
