import type { PrismaClient } from "@prisma/client";
import { BET_DEADLINE } from "@/lib/bet-constants";
import { prisma } from "@/lib/prisma";
import { closeBet as closeBetUseCase } from "@/modules/bet/application/close-bet";
import { copyBet as copyBetUseCase } from "@/modules/bet/application/copy-bet";
import { createBet as createBetUseCase } from "@/modules/bet/application/create-bet";
import { getPeerBet as getPeerBetUseCase } from "@/modules/bet/application/get-peer-bet";
import { listSummaries as listSummariesUseCase } from "@/modules/bet/application/list-summaries";
import { removeBet as removeBetUseCase } from "@/modules/bet/application/remove-bet";
import { renameBet as renameBetUseCase } from "@/modules/bet/application/rename-bet";
import { reopenBet as reopenBetUseCase } from "@/modules/bet/application/reopen-bet";
import { summariesByOwners as summariesByOwnersUseCase } from "@/modules/bet/application/summaries-by-owners";
import { updateBetPredictions as updateBetPredictionsUseCase } from "@/modules/bet/application/update-bet-predictions";
import type { BetRepository } from "@/modules/bet/domain/bet-repository";
import { BettingWindow } from "@/modules/bet/domain/betting-window";
import { InMemoryBetRepository } from "@/modules/bet/infrastructure/in-memory-bet-repository";
import { PrismaBetRepository } from "@/modules/bet/infrastructure/prisma-bet-repository";

import { createCommunity as createCommunityUseCase } from "@/modules/community/application/create-community";
import { deleteCommunity as deleteCommunityUseCase } from "@/modules/community/application/delete-community";
import { joinCommunity as joinCommunityUseCase } from "@/modules/community/application/join-community";
import { leaveCommunity as leaveCommunityUseCase } from "@/modules/community/application/leave-community";
import { regenerateInviteToken as regenerateInviteTokenUseCase } from "@/modules/community/application/regenerate-invite-token";
import { removeMember as removeMemberUseCase } from "@/modules/community/application/remove-member";
import type { CommunityRepository } from "@/modules/community/domain/community-repository";
import { InMemoryCommunityRepository } from "@/modules/community/infrastructure/in-memory-community-repository";
import { PrismaCommunityRepository } from "@/modules/community/infrastructure/prisma-community-repository";

import { getLeaderboard as getLeaderboardUseCase } from "@/modules/leaderboard/application/get-leaderboard";
import { tickLiveFeed as tickLiveFeedUseCase } from "@/modules/live/application/tick-live-feed";
import { upsertLiveResult as upsertLiveResultUseCase } from "@/modules/live/application/upsert-live-result";
import type { Clock as LiveClock } from "@/modules/live/domain/clock";
import type { LiveFeed } from "@/modules/live/domain/live-feed";
import type { LiveResult } from "@/modules/live/domain/live-result";
import type { LiveResultRepository } from "@/modules/live/domain/live-result-repository";
import { InMemoryLiveResultRepository } from "@/modules/live/infrastructure/in-memory-live-result-repository";
import { PrismaLiveResultRepository } from "@/modules/live/infrastructure/prisma-live-result-repository";

import type { Tournament } from "@/modules/tournament/domain/tournament";
import type { TournamentRepository } from "@/modules/tournament/domain/tournament-repository";
import { InMemoryTournamentRepository } from "@/modules/tournament/infrastructure/in-memory-tournament-repository";
import { PrismaTournamentRepository } from "@/modules/tournament/infrastructure/prisma-tournament-repository";

import { changeRole as changeRoleUseCase } from "@/modules/user/application/change-role";
import { promoteFirstRegistrant as promoteFirstRegistrantUseCase } from "@/modules/user/application/promote-first-registrant";
import { updateProfile as updateProfileUseCase } from "@/modules/user/application/update-profile";
import type { UserRepository } from "@/modules/user/domain/user-repository";
import { InMemoryUserRepository } from "@/modules/user/infrastructure/in-memory-user-repository";
import { PrismaUserRepository } from "@/modules/user/infrastructure/prisma-user-repository";

type BaseContainerDeps = {
  betRepo: BetRepository;
  communityRepo: CommunityRepository;
  userRepo: UserRepository;
  tournamentRepo: TournamentRepository;
  liveResultRepo: LiveResultRepository;
  clock: () => Date;
  betDeadline: Date;
};

export function createBaseContainer(deps: BaseContainerDeps) {
  const window = new BettingWindow(deps.betDeadline);

  const getNameResolver = (initialCache?: Map<string, string | null>) => {
    const cache = new Map<string, string | null>(initialCache);
    return async (userId: string): Promise<string | null> => {
      if (cache.has(userId)) {
        return cache.get(userId) ?? null;
      }
      const user = await deps.userRepo.findById(userId);
      const name = user ? user.name : null;
      cache.set(userId, name);
      return name;
    };
  };

  const defaultNameResolver = getNameResolver();

  return {
    getNameResolver,
    bets() {
      return {
        create(args: { userId: string; label: string; limit: number }) {
          return createBetUseCase(deps.betRepo, {
            ...args,
            window,
            now: deps.clock(),
          });
        },
        remove(args: { betId: string; userId: string }) {
          return removeBetUseCase(deps.betRepo, {
            ...args,
            window,
            now: deps.clock(),
          });
        },
        close(args: { betId: string; userId: string }) {
          return closeBetUseCase(deps.betRepo, {
            ...args,
            window,
            now: deps.clock(),
          });
        },
        reopen(args: { betId: string; userId: string }) {
          return reopenBetUseCase(deps.betRepo, {
            ...args,
            window,
            now: deps.clock(),
          });
        },
        copy(args: { betId: string; userId: string; limit: number }) {
          return copyBetUseCase(deps.betRepo, {
            ...args,
            window,
            now: deps.clock(),
          });
        },
        rename(args: { betId: string; userId: string; label: string }) {
          return renameBetUseCase(deps.betRepo, {
            ...args,
            window,
            now: deps.clock(),
          });
        },
        updatePredictions(args: {
          betId: string;
          userId: string;
          groupPredictions: {
            groupOrders: Record<string, string[]>;
            thirdPlaceOrder: string[];
          } | null;
          knockoutWinners: Record<string, string>;
        }) {
          return updateBetPredictionsUseCase(deps.betRepo, {
            ...args,
            window,
            now: deps.clock(),
          });
        },
        listSummaries(userId: string) {
          return listSummariesUseCase(deps.betRepo, userId);
        },
        summariesByOwners(userIds: string[]) {
          return summariesByOwnersUseCase(deps.betRepo, userIds);
        },
        findById(id: string) {
          return deps.betRepo.findById(id);
        },
        getPeerBet(
          args: {
            viewerId: string;
            communitySlug: string;
            betId: string;
          },
          nameResolver?: (userId: string) => Promise<string | null>,
        ) {
          const resolver = nameResolver ?? defaultNameResolver;
          return getPeerBetUseCase(deps.betRepo, deps.communityRepo, resolver, {
            ...args,
            window,
            now: deps.clock(),
          });
        },
        isPastDeadline() {
          return window.isClosed(deps.clock());
        },
        get deadline() {
          return deps.betDeadline;
        },
      };
    },
    communities() {
      return {
        create(args: { ownerId: string; name: string; inviteToken: string }) {
          return createCommunityUseCase(deps.communityRepo, args);
        },
        delete(args: { actorId: string; slug: string }) {
          return deleteCommunityUseCase(deps.communityRepo, args);
        },
        join(args: { userId: string; inviteToken: string }) {
          return joinCommunityUseCase(deps.communityRepo, args);
        },
        leave(args: { userId: string; slug: string }) {
          return leaveCommunityUseCase(deps.communityRepo, args);
        },
        regenerateInviteToken(args: {
          actorId: string;
          slug: string;
          newToken: string;
        }) {
          return regenerateInviteTokenUseCase(deps.communityRepo, args);
        },
        removeMember(args: {
          actorId: string;
          targetUserId: string;
          slug: string;
        }) {
          return removeMemberUseCase(deps.communityRepo, args);
        },
        findBySlug(slug: string) {
          return deps.communityRepo.findBySlug(slug);
        },
      };
    },
    tournament() {
      return {
        get() {
          return deps.tournamentRepo.get();
        },
        save(tournament: Tournament) {
          return deps.tournamentRepo.save(tournament);
        },
      };
    },
    live() {
      return {
        findByNum(num: number) {
          return deps.liveResultRepo.findByNum(num);
        },
        findAll() {
          return deps.liveResultRepo.findAll();
        },
        save(liveResult: LiveResult) {
          return deps.liveResultRepo.save(liveResult);
        },
        upsert(args: {
          num: number;
          status: "upcoming" | "live" | "finished";
          goals1: number;
          goals2: number;
          penalties1?: number;
          penalties2?: number;
          allowCreate: boolean;
          adminOverride?: boolean;
        }) {
          return upsertLiveResultUseCase(deps.liveResultRepo, args);
        },
        tick(feed: LiveFeed, clock: LiveClock) {
          return tickLiveFeedUseCase(deps.liveResultRepo, feed, clock);
        },
      };
    },
    users() {
      return {
        updateProfile(args: {
          userId: string;
          name: string;
          image: string | null;
        }) {
          return updateProfileUseCase(deps.userRepo, args);
        },
        changeRole(args: {
          actorId: string;
          targetUserId: string;
          newRole: string;
        }) {
          return changeRoleUseCase(deps.userRepo, args);
        },
        promoteFirstRegistrant(args: { userId: string }) {
          return promoteFirstRegistrantUseCase(deps.userRepo, args);
        },
        findById(userId: string) {
          return deps.userRepo.findById(userId);
        },
      };
    },
    leaderboard() {
      return {
        get(
          query: {
            viewerId: string;
            communitySlug: string;
          },
          nameResolver?: (userId: string) => Promise<string | null>,
        ) {
          const resolver = nameResolver ?? defaultNameResolver;
          return getLeaderboardUseCase(
            deps.communityRepo,
            deps.betRepo,
            deps.tournamentRepo,
            deps.liveResultRepo,
            resolver,
            {
              viewerId: query.viewerId,
              communitySlug: query.communitySlug,
              window,
              now: deps.clock(),
            },
          );
        },
      };
    },
  };
}

export function createContainer(deps: {
  prisma: PrismaClient;
  clock: () => Date;
  betDeadline: Date;
}) {
  const betRepo = new PrismaBetRepository(deps.prisma);
  const communityRepo = new PrismaCommunityRepository(deps.prisma);
  const userRepo = new PrismaUserRepository(deps.prisma);
  const tournamentRepo = new PrismaTournamentRepository(deps.prisma);
  const liveResultRepo = new PrismaLiveResultRepository(deps.prisma);

  return createBaseContainer({
    betRepo,
    communityRepo,
    userRepo,
    tournamentRepo,
    liveResultRepo,
    clock: deps.clock,
    betDeadline: deps.betDeadline,
  });
}

export function createTestContainer(deps?: {
  betRepo?: InMemoryBetRepository;
  communityRepo?: InMemoryCommunityRepository;
  userRepo?: InMemoryUserRepository;
  tournamentRepo?: InMemoryTournamentRepository;
  liveResultRepo?: InMemoryLiveResultRepository;
  clock?: () => Date;
  betDeadline?: Date;
}) {
  const clock = deps?.clock ?? (() => new Date("2026-06-01T00:00:00Z"));
  const betDeadline = deps?.betDeadline ?? new Date("2026-06-11T19:00:00Z");

  return createBaseContainer({
    betRepo: deps?.betRepo ?? new InMemoryBetRepository(),
    communityRepo: deps?.communityRepo ?? new InMemoryCommunityRepository(),
    userRepo: deps?.userRepo ?? new InMemoryUserRepository(),
    tournamentRepo: deps?.tournamentRepo ?? new InMemoryTournamentRepository(),
    liveResultRepo: deps?.liveResultRepo ?? new InMemoryLiveResultRepository(),
    clock,
    betDeadline,
  });
}

export const container = createContainer({
  prisma,
  clock: () => new Date(),
  betDeadline: BET_DEADLINE,
});

export type Container = ReturnType<typeof createContainer>;
