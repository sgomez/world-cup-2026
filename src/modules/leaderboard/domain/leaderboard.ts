import { createInitialState } from "@/lib/prediction-state";
import type { ScoreableContent } from "@/lib/scoring";
import { extractScoreableContent, scoreBet } from "@/lib/scoring";
import type {
  Bet,
  BetStatus,
  GroupPredictions,
} from "@/modules/bet/domain/bet";
import type { BettingWindow } from "@/modules/bet/domain/betting-window";

export type LeaderboardEntry = {
  betId: string;
  userId: string;
  userName: string;
  betName: string;
  points: number;
  createdAt: Date;
  rank: number;
  hasCup: boolean;
  selectionsHidden: boolean;
  signature?: string;
  bet: {
    id: string;
    label: string;
    userId: string;
    status: BetStatus;
    createdAt?: Date;
    groupPredictions: GroupPredictions | null;
    knockoutWinners: Record<string, string>;
  } | null;
};

export class Leaderboard {
  private constructor(private readonly rankedEntries: LeaderboardEntry[]) {}

  /**
   * Factory method to calculate and rank bets into a leaderboard projection.
   *
   * @param betsWithOwners List of Bet aggregates paired with their owner's name.
   * @param actualResult The derived tournament result used for scoring.
   * @param window The betting window policy.
   * @param now The current timestamp.
   * @param viewerUserId The ID of the current user viewing the leaderboard (if any).
   * @param isCompetitionEnded True if the tournament is completely finished.
   */
  static create(
    betsWithOwners: { bet: Bet; ownerName: string }[],
    actualResult: ScoreableContent | null,
    window: BettingWindow,
    now: Date,
    viewerUserId: string | null,
    isCompetitionEnded: boolean,
  ): Leaderboard {
    // 1. Exclude draft bets from ranking.
    const activeBets = betsWithOwners.filter(
      ({ bet }) => bet.status === "closed",
    );

    // 2. Map bets to entries, applying secrecy rules.
    const isWindowOpen = window.isOpen(now);

    const entriesWithoutRank = activeBets.map(({ bet, ownerName }) => {
      const isOwner = viewerUserId !== null && bet.userId === viewerUserId;
      const selectionsHidden = isWindowOpen && !isOwner;

      let points = 0;
      if (!selectionsHidden && actualResult) {
        // Calculate actual score
        const { knockoutMatches } = createInitialState(
          bet.groupPredictions,
          bet.knockoutWinners,
        );
        const betContent = extractScoreableContent(knockoutMatches);
        points = scoreBet(betContent, actualResult);
      }

      // Redact predictions if selections are hidden
      const exposedBet = {
        id: bet.id,
        label: bet.label,
        userId: bet.userId,
        status: bet.status,
        createdAt: bet.createdAt,
        groupPredictions: selectionsHidden ? null : bet.groupPredictions,
        knockoutWinners: selectionsHidden ? {} : bet.knockoutWinners,
      };

      return {
        betId: bet.id,
        userId: bet.userId,
        userName: ownerName,
        betName: bet.label,
        points,
        createdAt: bet.createdAt ?? new Date(),
        selectionsHidden,
        signature: bet.signature,
        bet: exposedBet,
      };
    });

    // 3. Stable ranking (sorting by points descending, then by oldest creation date ascending).
    const sorted = [...entriesWithoutRank].sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    // 4. Assign positions (co-winner ranking positions: same points share the same rank).
    let lastPoints: number | null = null;
    let lastRank = 0;

    const rankedEntries: LeaderboardEntry[] = sorted.map((entry, index) => {
      const rank = entry.points === lastPoints ? lastRank : index + 1;
      lastPoints = entry.points;
      lastRank = rank;

      // Sets Cup award boolean to true for the top-placed bet(s) only when the tournament has ended.
      const hasCup = isCompetitionEnded && rank === 1;

      return {
        ...entry,
        rank,
        hasCup,
      };
    });

    return new Leaderboard(rankedEntries);
  }

  get entries(): LeaderboardEntry[] {
    return this.rankedEntries;
  }

  get groupedEntries(): { rank: number; entries: LeaderboardEntry[] }[] {
    const groups: { rank: number; entries: LeaderboardEntry[] }[] = [];
    for (const entry of this.rankedEntries) {
      let group = groups.find((g) => g.rank === entry.rank);
      if (!group) {
        group = { rank: entry.rank, entries: [] };
        groups.push(group);
      }
      group.entries.push(entry);
    }
    return groups;
  }
}
