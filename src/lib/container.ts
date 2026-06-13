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
import { updateBetPredictions as updateBetPredictionsUseCase } from "@/modules/bet/application/update-bet-predictions";
import type { BetRepository } from "@/modules/bet/domain/bet-repository";
import { BettingWindow } from "@/modules/bet/domain/betting-window";
import { InMemoryBetRepository } from "@/modules/bet/infrastructure/in-memory-bet-repository";
import { PrismaBetRepository } from "@/modules/bet/infrastructure/prisma-bet-repository";
import type { CommunityRepository } from "@/modules/community/domain/community-repository";
import { InMemoryCommunityRepository } from "@/modules/community/infrastructure/in-memory-community-repository";
import { PrismaCommunityRepository } from "@/modules/community/infrastructure/prisma-community-repository";
import type { UserRepository } from "@/modules/user/domain/user-repository";
import { InMemoryUserRepository } from "@/modules/user/infrastructure/in-memory-user-repository";
import { PrismaUserRepository } from "@/modules/user/infrastructure/prisma-user-repository";

type BaseContainerDeps = {
  betRepo: BetRepository;
  communityRepo: CommunityRepository;
  userRepo: UserRepository;
  clock: () => Date;
  betDeadline: Date;
};

export function createBaseContainer(deps: BaseContainerDeps) {
  const window = new BettingWindow(deps.betDeadline);
  const userCache = new Map<string, string | null>();

  const getUserName = async (userId: string): Promise<string | null> => {
    if (userCache.has(userId)) {
      return userCache.get(userId) ?? null;
    }
    const user = await deps.userRepo.findById(userId);
    const name = user ? user.name : null;
    userCache.set(userId, name);
    return name;
  };

  return {
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
        findById(id: string) {
          return deps.betRepo.findById(id);
        },
        getPeerBet(args: {
          viewerId: string;
          communitySlug: string;
          betId: string;
        }) {
          return getPeerBetUseCase(
            deps.betRepo,
            deps.communityRepo,
            getUserName,
            {
              ...args,
              window,
              now: deps.clock(),
            },
          );
        },
        isPastDeadline() {
          return window.isClosed(deps.clock());
        },
        get deadline() {
          return deps.betDeadline;
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

  return createBaseContainer({
    betRepo,
    communityRepo,
    userRepo,
    clock: deps.clock,
    betDeadline: deps.betDeadline,
  });
}

export function createTestContainer(deps?: {
  betRepo?: InMemoryBetRepository;
  communityRepo?: InMemoryCommunityRepository;
  userRepo?: InMemoryUserRepository;
  clock?: () => Date;
  betDeadline?: Date;
}) {
  const clock = deps?.clock ?? (() => new Date("2026-06-01T00:00:00Z"));
  const betDeadline = deps?.betDeadline ?? new Date("2026-06-11T19:00:00Z");

  return createBaseContainer({
    betRepo: deps?.betRepo ?? new InMemoryBetRepository(),
    communityRepo: deps?.communityRepo ?? new InMemoryCommunityRepository(),
    userRepo: deps?.userRepo ?? new InMemoryUserRepository(),
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
