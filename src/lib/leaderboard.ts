import type { Bet } from "@/modules/bet/domain/bet";
import { createInitialState } from "./prediction-state";
import {
  scoreBet as calcScoreBet,
  extractScoreableContent,
  type ScoreableContentArrays,
  toScoreableContent,
} from "./scoring";

export type LeaderboardEntry = {
  id: string; // The Bet ID
  userId: string; // User ID to check if it's the current user
  userName: string; // Participant's name
  betName: string; // Bet's label
  points: number; // The score/points
  createdAt: Date; // For stable tiebreaking
  signature?: string;
};

export type LeaderboardScope = {
  id: string; // Community slug
  label: string; // Community name
  entries: LeaderboardEntry[];
};

export function rankEntries(
  entries: LeaderboardEntry[],
): (LeaderboardEntry & { rank: number })[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  let lastPoints: number | null = null;
  let lastRank = 0;

  return sorted.map((entry, index) => {
    const rank = entry.points === lastPoints ? lastRank : index + 1;
    lastPoints = entry.points;
    lastRank = rank;
    return { ...entry, rank };
  });
}

export function scopeMapper(
  communities: {
    id: string;
    name: string;
    slug: string;
    members: {
      user: {
        id: string;
        name: string;
        image: string | null;
      };
    }[];
  }[],
  betsByOwner: Map<string, Bet[]>,
  actualResults: ScoreableContentArrays | null,
  isPastDeadline: boolean,
): LeaderboardScope[] {
  const actualContent = actualResults
    ? toScoreableContent(actualResults)
    : null;

  return communities.map((community) => {
    const entries: LeaderboardEntry[] = [];

    for (const member of community.members) {
      const user = member.user;
      const bets = betsByOwner.get(user.id) ?? [];

      for (const bet of bets) {
        if (bet.status === "closed") {
          let points = 0;
          if (isPastDeadline && actualContent) {
            const { knockoutMatches } = createInitialState(
              bet.groupPredictions,
              bet.knockoutWinners,
            );
            const betContent = extractScoreableContent(knockoutMatches);
            points = calcScoreBet(betContent, actualContent);
          }

          entries.push({
            id: bet.id,
            userId: user.id,
            userName: user.name,
            betName: bet.label,
            points,
            createdAt: bet.createdAt ?? new Date(),
            signature: bet.signature,
          });
        }
      }
    }

    return {
      id: community.slug,
      label: community.name,
      entries,
    };
  });
}
