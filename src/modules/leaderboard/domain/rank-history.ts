import type { Bet } from "@/modules/bet/domain/bet";
import type { LiveResult } from "@/modules/live/domain/live-result";
import { extractScoreableContent, score } from "@/modules/score";
import { Tournament } from "@/modules/tournament/domain/tournament";

export interface RankHistoryStep {
  matchNum: number;
  isLive: boolean;
  ranks: Record<
    string,
    {
      rank: number;
      points: number;
    }
  >;
}

/**
 * Pure domain function to compute the chronological leaderboard rank history of Bets in a Community.
 * This simulates the leaderboard state at Match 0 and at each finished (and optionally live/provisional) match step.
 */
export function calculateRankHistory(
  bets: Bet[],
  liveResults: LiveResult[],
  tournament: Tournament | null,
): RankHistoryStep[] {
  const closedBets = bets.filter((b) => b.status === "closed");
  const activeTournament = tournament ?? Tournament.createDefault();

  const steps: RankHistoryStep[] = [];

  // Step 0: Initial state (Match 0) - All closed bets start at rank 1 with 0 points
  const step0Ranks: Record<string, { rank: number; points: number }> = {};
  for (const bet of closedBets) {
    step0Ranks[bet.id] = { rank: 1, points: 0 };
  }
  steps.push({
    matchNum: 0,
    isLive: false,
    ranks: step0Ranks,
  });

  // Collect and sort finished match numbers in ascending order
  const finishedNums = Array.from(
    new Set(
      liveResults.filter((lr) => lr.status === "finished").map((lr) => lr.num),
    ),
  ).sort((a, b) => a - b);

  // Compute rank and points for each finished match step
  for (const k of finishedNums) {
    const slice = liveResults.filter(
      (lr) => lr.status === "finished" && lr.num <= k,
    );
    const bracketView = activeTournament.bracketView(slice, {
      finishedOnly: true,
    });
    const answerKey = extractScoreableContent(bracketView);

    const scoredBets = closedBets.map((bet) => {
      const betContent = bet.scoreableContent();
      const points = score(betContent, answerKey);
      return {
        betId: bet.id,
        points,
        createdAt: bet.createdAt ?? new Date(0),
      };
    });

    // Stable sort: points descending, then createdAt ascending
    const sorted = [...scoredBets].sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    let lastPoints: number | null = null;
    let lastRank = 0;

    const ranks: Record<string, { rank: number; points: number }> = {};
    sorted.forEach((entry, index) => {
      const rank = entry.points === lastPoints ? lastRank : index + 1;
      lastPoints = entry.points;
      lastRank = rank;
      ranks[entry.betId] = { rank, points: entry.points };
    });

    steps.push({
      matchNum: k,
      isLive: false,
      ranks,
    });
  }

  // Provisional Step: If any match is currently live, calculate a final provisional step
  const hasLive = liveResults.some((lr) => lr.status === "live");
  if (hasLive) {
    const slice = liveResults.filter(
      (lr) => lr.status === "finished" || lr.status === "live",
    );
    const maxNum = slice.length > 0 ? Math.max(...slice.map((m) => m.num)) : 0;

    const bracketView = activeTournament.bracketView(slice, {
      provisional: true,
    });
    const answerKey = extractScoreableContent(bracketView);

    const scoredBets = closedBets.map((bet) => {
      const betContent = bet.scoreableContent();
      const points = score(betContent, answerKey);
      return {
        betId: bet.id,
        points,
        createdAt: bet.createdAt ?? new Date(0),
      };
    });

    const sorted = [...scoredBets].sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    let lastPoints: number | null = null;
    let lastRank = 0;

    const ranks: Record<string, { rank: number; points: number }> = {};
    sorted.forEach((entry, index) => {
      const rank = entry.points === lastPoints ? lastRank : index + 1;
      lastPoints = entry.points;
      lastRank = rank;
      ranks[entry.betId] = { rank, points: entry.points };
    });

    steps.push({
      matchNum: maxNum,
      isLive: true,
      ranks,
    });
  }

  return steps;
}
