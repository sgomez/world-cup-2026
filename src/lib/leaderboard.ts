import type { BetSummary } from "@/modules/bet/application/bet-summary";

export type LeaderboardEntry = {
  id: string; // The Bet ID
  userId: string; // User ID to check if it's the current user
  userName: string; // Participant's name
  betName: string; // Bet's label
  points: number; // The score/points (stubbed to 0 for now)
  createdAt: Date; // For stable tiebreaking
};

export type LeaderboardScope = {
  id: string; // Community slug
  label: string; // Community name
  entries: LeaderboardEntry[];
};

export function scoreBet(_bet: { id: string }): number {
  return 0;
}

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
  betSummariesByOwner: Map<string, BetSummary[]>,
): LeaderboardScope[] {
  return communities.map((community) => {
    const entries: LeaderboardEntry[] = [];

    for (const member of community.members) {
      const user = member.user;
      const bets = betSummariesByOwner.get(user.id) ?? [];

      for (const bet of bets) {
        if (bet.status === "closed") {
          entries.push({
            id: bet.id,
            userId: user.id,
            userName: user.name,
            betName: bet.label,
            points: scoreBet(bet),
            createdAt: bet.createdAt,
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
