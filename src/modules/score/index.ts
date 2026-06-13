import { KNOCKOUT_MATCH_IDS, type KnockoutMatch } from "@/lib/bracket-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

export interface RoundBreakdown {
  matched: number;
  points: number;
}

export interface WinnerBreakdown {
  matched: boolean;
  points: number;
}

export interface ScoreBreakdown {
  R32: RoundBreakdown;
  R16: RoundBreakdown;
  QF: RoundBreakdown;
  SF: RoundBreakdown;
  F: RoundBreakdown;
  champion: WinnerBreakdown;
  thirdPlace: WinnerBreakdown;
  total: number;
}

// ---------------------------------------------------------------------------
// Points policy
// ---------------------------------------------------------------------------

export const ROUND_POINTS: Record<string, number> = {
  R32: 3,
  R16: 4,
  QF: 5,
  SF: 6,
  F: 8,
};
export const THIRD_PLACE_POINTS = 5;
export const CHAMPION_POINTS = 10;

// ---------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Scoring interface
// ---------------------------------------------------------------------------

/**
 * Computes a detailed breakdown of points earned by a bet against an answer key.
 *
 * Scoring rules:
 * - Per-round team membership: each team correctly predicted for a round earns ROUND_POINTS[round].
 * - Champion identity: exact match earns CHAMPION_POINTS.
 * - Third-place identity: exact match earns THIRD_PLACE_POINTS.
 */
export function scoreBreakdown(
  betContent: ScoreableContent,
  answerKey: ScoreableContent,
): ScoreBreakdown {
  const breakdown: Partial<ScoreBreakdown> = {};
  let total = 0;

  for (const round of ["R32", "R16", "QF", "SF", "F"] as const) {
    const pointsPerTeam = ROUND_POINTS[round] || 0;
    const betRound = betContent[round];
    const answerRound = answerKey[round];

    let matchedCount = 0;
    for (const teamId of betRound) {
      if (answerRound.has(teamId)) {
        matchedCount++;
      }
    }
    const points = matchedCount * pointsPerTeam;
    breakdown[round] = {
      matched: matchedCount,
      points,
    };
    total += points;
  }

  const championMatched = !!(
    betContent.champion &&
    answerKey.champion &&
    betContent.champion === answerKey.champion
  );
  const championPoints = championMatched ? CHAMPION_POINTS : 0;
  breakdown.champion = {
    matched: championMatched,
    points: championPoints,
  };
  total += championPoints;

  const thirdPlaceMatched = !!(
    betContent.thirdPlace &&
    answerKey.thirdPlace &&
    betContent.thirdPlace === answerKey.thirdPlace
  );
  const thirdPlacePoints = thirdPlaceMatched ? THIRD_PLACE_POINTS : 0;
  breakdown.thirdPlace = {
    matched: thirdPlaceMatched,
    points: thirdPlacePoints,
  };
  total += thirdPlacePoints;

  breakdown.total = total;

  return breakdown as ScoreBreakdown;
}

/**
 * Computes the total points earned by a bet against an answer key.
 */
export function score(
  betContent: ScoreableContent,
  answerKey: ScoreableContent,
): number {
  return scoreBreakdown(betContent, answerKey).total;
}
