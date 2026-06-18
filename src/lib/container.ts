import type { PrismaClient } from "@prisma/client";
import { ARCADE_STALE_TOLERANCE_MS } from "@/config/arcade";
import { BET_DEADLINE } from "@/config/bet";
import { prisma } from "@/lib/prisma";
import { finishPenguinRun as finishPenguinRunUseCase } from "@/modules/arcade/application/finish-penguin-run";
import {
  type ArcadeRankingEntry,
  getArcadeRanking as getArcadeRankingUseCase,
} from "@/modules/arcade/application/get-arcade-ranking";
import { recordHeartbeat as recordHeartbeatUseCase } from "@/modules/arcade/application/record-heartbeat";
import { recordRound as recordRoundUseCase } from "@/modules/arcade/application/record-round";
import { startPenguinRun as startPenguinRunUseCase } from "@/modules/arcade/application/start-penguin-run";
import type { ArcadeRunRepository } from "@/modules/arcade/domain/arcade-run-repository";
import { toPlayDay } from "@/modules/arcade/domain/penguin-run";
import { InMemoryArcadeRunRepository } from "@/modules/arcade/infrastructure/in-memory-arcade-run-repository";
import { PrismaArcadeRunRepository } from "@/modules/arcade/infrastructure/prisma-arcade-run-repository";
import { closeBet as closeBetUseCase } from "@/modules/bet/application/close-bet";
import { copyBet as copyBetUseCase } from "@/modules/bet/application/copy-bet";
import { createBet as createBetUseCase } from "@/modules/bet/application/create-bet";
import { getPeerBet as getPeerBetUseCase } from "@/modules/bet/application/get-peer-bet";
import { importDirectBets as importDirectBetsUseCase } from "@/modules/bet/application/import-direct-bets";
import { listSummaries as listSummariesUseCase } from "@/modules/bet/application/list-summaries";
import { removeBet as removeBetUseCase } from "@/modules/bet/application/remove-bet";
import { renameBet as renameBetUseCase } from "@/modules/bet/application/rename-bet";
import { reopenBet as reopenBetUseCase } from "@/modules/bet/application/reopen-bet";
import { summariesByOwners as summariesByOwnersUseCase } from "@/modules/bet/application/summaries-by-owners";
import { updateBetPredictions as updateBetPredictionsUseCase } from "@/modules/bet/application/update-bet-predictions";
import type { BetRepository } from "@/modules/bet/domain/bet-repository";
import { BettingWindow } from "@/modules/bet/domain/betting-window";
import type { SheetParser } from "@/modules/bet/domain/sheet-parser";
import { ExceljsSheetParser } from "@/modules/bet/infrastructure/exceljs-sheet-parser";
import { InMemoryBetRepository } from "@/modules/bet/infrastructure/in-memory-bet-repository";
import { PrismaBetRepository } from "@/modules/bet/infrastructure/prisma-bet-repository";
import { createCommunity as createCommunityUseCase } from "@/modules/community/application/create-community";
import { deleteCommunity as deleteCommunityUseCase } from "@/modules/community/application/delete-community";
import { joinCommunity as joinCommunityUseCase } from "@/modules/community/application/join-community";
import { leaveCommunity as leaveCommunityUseCase } from "@/modules/community/application/leave-community";
import { regenerateInviteToken as regenerateInviteTokenUseCase } from "@/modules/community/application/regenerate-invite-token";
import { removeMember as removeMemberUseCase } from "@/modules/community/application/remove-member";
import type { CommunityRepository } from "@/modules/community/domain/community-repository";
import type { ImportOwnerProvisioner } from "@/modules/community/domain/import-owner-provisioner";
import { InMemoryCommunityRepository } from "@/modules/community/infrastructure/in-memory-community-repository";
import { InMemoryImportOwnerProvisioner } from "@/modules/community/infrastructure/in-memory-import-owner-provisioner";
import { PrismaCommunityRepository } from "@/modules/community/infrastructure/prisma-community-repository";
import { PrismaImportOwnerProvisioner } from "@/modules/community/infrastructure/prisma-import-owner-provisioner";
import { getLeaderboard as getLeaderboardUseCase } from "@/modules/leaderboard/application/get-leaderboard";
import { getRankHistory as getRankHistoryUseCase } from "@/modules/leaderboard/application/get-rank-history";
import { getShareCard as getShareCardUseCase } from "@/modules/leaderboard/application/get-share-card";
import { createLiveResult as createLiveResultUseCase } from "@/modules/live/application/create-live-result";
import { setLiveResultLink as setLiveResultLinkUseCase } from "@/modules/live/application/set-live-result-link";
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
  ownerProvisioner: ImportOwnerProvisioner;
  arcadeRunRepo: ArcadeRunRepository;
  clock: () => Date;
  betDeadline: Date;
  sheetParser: SheetParser;
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

  const defaultNameResolver = async (
    userId: string,
  ): Promise<string | null> => {
    const user = await deps.userRepo.findById(userId);
    return user ? user.name : null;
  };

  return {
    getNameResolver,
    repos: {
      bet: deps.betRepo,
      community: deps.communityRepo,
      user: deps.userRepo,
      tournament: deps.tournamentRepo,
      liveResult: deps.liveResultRepo,
      ownerProvisioner: deps.ownerProvisioner,
    },
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
        importDirect(args: {
          mode: "create" | "reuse";
          communityName?: string;
          communityId?: string;
          fileBuffer: Buffer;
          inviteToken?: string;
        }) {
          return importDirectBetsUseCase(
            deps.sheetParser,
            deps.ownerProvisioner,
            deps.communityRepo,
            deps.betRepo,
            args,
          );
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
        create(args: { num: number; link?: string }) {
          return createLiveResultUseCase(deps.liveResultRepo, args);
        },
        setLink(args: { num: number; link: string }) {
          return setLiveResultLinkUseCase(deps.liveResultRepo, args);
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
        shareCard(query: { communitySlug: string }) {
          return getShareCardUseCase(
            deps.communityRepo,
            deps.betRepo,
            deps.tournamentRepo,
            deps.liveResultRepo,
            {
              communitySlug: query.communitySlug,
              window,
              now: deps.clock(),
            },
          );
        },
        rankHistory(
          query: {
            viewerId: string;
            communitySlug: string;
          },
          nameResolver?: (userId: string) => Promise<string | null>,
        ) {
          const resolver = nameResolver ?? defaultNameResolver;
          return getRankHistoryUseCase(
            deps.communityRepo,
            deps.betRepo,
            deps.tournamentRepo,
            deps.liveResultRepo,
            resolver,
            query,
          );
        },
      };
    },
    arcade() {
      return {
        startRun(args: { userId: string }) {
          return startPenguinRunUseCase(deps.arcadeRunRepo, {
            userId: args.userId,
            clock: deps.clock,
          });
        },
        recordHeartbeat(args: { runId: string; userId: string }) {
          return recordHeartbeatUseCase(deps.arcadeRunRepo, {
            runId: args.runId,
            userId: args.userId,
            clock: deps.clock,
          });
        },
        recordRound(args: {
          runId: string;
          userId: string;
          roundStartedAt: Date;
          reportedScore: number;
        }) {
          return recordRoundUseCase(deps.arcadeRunRepo, {
            runId: args.runId,
            userId: args.userId,
            roundStartedAt: args.roundStartedAt,
            reportedScore: args.reportedScore,
            clock: deps.clock,
          });
        },
        finishRun(args: { runId: string; userId: string }) {
          return finishPenguinRunUseCase(deps.arcadeRunRepo, {
            runId: args.runId,
            userId: args.userId,
          });
        },
        /** Returns the global Arcade Ranking, lazily finalising stale runs. */
        getRanking(
          nameResolver?: (userId: string) => Promise<string | null>,
        ): Promise<ArcadeRankingEntry[]> {
          return getArcadeRankingUseCase(deps.arcadeRunRepo, {
            clock: deps.clock,
            staleTolerance: ARCADE_STALE_TOLERANCE_MS,
            nameResolver,
          });
        },
        /** Returns true if the user has already played Penguin Run today (UTC). */
        async hasPlayedToday(userId: string): Promise<boolean> {
          const playDay = toPlayDay(deps.clock());
          const run = await deps.arcadeRunRepo.findByUserAndPlayDay(
            userId,
            playDay,
          );
          return run !== null;
        },
        /** The current Play Day (UTC calendar date string) derived from the container clock. */
        get todayPlayDay(): string {
          return toPlayDay(deps.clock());
        },
      };
    },
  };
}

/**
 * The composition root (Dependency Injection Container) for the application.
 * It wires infrastructure repositories (Prisma-backed or InMemory) with domain-specific
 * use cases, providing a unified, decoupled API seam for Next.js Server Actions and Pages.
 *
 * Dependency Direction:
 *   Next.js App Components / Actions -> Container (Boundary) -> Application Services (Use Cases) -> Domain
 *
 * The container exposes the following modules/accessors:
 *
 * - **`bets()`**: Operates on tournament predictions (Bracket Bets and Direct Bets).
 *   - `create({ userId, label, limit })`: Creates a new Bracket Bet in `draft` status.
 *   - `remove({ betId, userId })`: Deletes a bet.
 *   - `close({ betId, userId })`: Validates predictions and transitions bet to `closed` status.
 *   - `reopen({ betId, userId })`: Reopens a closed bet back to `draft` before the deadline.
 *   - `copy({ betId, userId, limit })`: Copies an existing bet.
 *   - `rename({ betId, userId, label })`: Updates a bet's label.
 *   - `updatePredictions(...)`: Updates the group and knockout predictions.
 *   - `listSummaries(userId)`: Lists a user's bet summaries.
 *   - `summariesByOwners(userIds)`: Lists summaries for multiple users.
 *   - `findById(id)`: Reads a bet by ID.
 *   - `getPeerBet(args, nameResolver)`: Reads peer bet predictions (obfuscated or full).
 *   - `isPastDeadline()`: Checks if current time is past the bet deadline.
 *   - `importDirect(args)`: Parses Excel spreadsheets and imports direct bets.
 *   - `deadline`: Read-only access to the hard bet deadline.
 *
 * - **`communities()`**: Operates on shared user groups.
 *   - `create({ ownerId, name, inviteToken })`: Creates a new community.
 *   - `delete({ actorId, slug })`: Deletes a community (restricted to owner).
 *   - `join({ userId, inviteToken })`: Joins a community using an invite token.
 *   - `leave({ userId, slug })`: Removes a user from a community.
 *   - `regenerateInviteToken({ actorId, slug, newToken })`: Rotates the invite token.
 *   - `removeMember({ actorId, targetUserId, slug })`: Removes a member.
 *   - `findBySlug(slug)`: Finds a community by its slug.
 *
 * - **`tournament()`**: Reads and saves tournament configurations.
 *   - `get()`: Fetches the current tournament settings.
 *   - `save(tournament)`: Saves or updates the tournament settings.
 *
 * - **`live()`**: Manages live results, scores, and mock feed ticks.
 *   - `findByNum(num)`: Fetches a live result by Match Number.
 *   - `findAll()`: Fetches all live results.
 *   - `save(liveResult)`: Saves a live result.
 *   - `upsert(args)`: Creates or updates a live result.
 *   - `tick(feed, clock)`: Promotes schedule and processes feed ticks.
 *
 * - **`users()`**: Operates on user profiles and roles.
 *   - `updateProfile({ userId, name, image })`: Updates profile information.
 *   - `changeRole({ actorId, targetUserId, newRole })`: Modifies a user's role.
 *   - `promoteFirstRegistrant({ userId })`: Promotes the first registrant to super_admin.
 *   - `findById(userId)`: Finds a user by ID.
 *
 * - **`leaderboard()`**: Calculates rankings.
 *   - `get(query, nameResolver)`: Gets the community leaderboard.
 *   - `shareCard({ communitySlug })`: Gets share-card data for OG image (native communities only).
 *
 * Other Core Accessors & Seams:
 * - **`getNameResolver(initialCache?)`**: Returns a memoized name resolver.
 * - **`transaction(callback)`**: Provides transactional boundaries. Runs the callback within a Prisma transaction or test-backup rollback scope.
 * - **`repos`**: Directly exposes repositories for query-only access or advanced scenarios.
 */
export type Container = ReturnType<typeof createBaseContainer> & {
  transaction<T>(
    callback: (
      txContainer: ReturnType<typeof createBaseContainer>,
    ) => Promise<T>,
  ): Promise<T>;
};

/**
 * Factory to create the production Container backed by Prisma repositories
 * and real infrastructure adapters.
 *
 * @param deps - Dependencies configuration
 * @param deps.prisma - The Prisma client instance
 * @param deps.clock - Function returning current Date (avoids system local clock reliance)
 * @param deps.betDeadline - The hard-coded Bet deadline Date
 */
export function createContainer(deps: {
  prisma: PrismaClient;
  clock: () => Date;
  betDeadline: Date;
}): Container {
  const betRepo = new PrismaBetRepository(deps.prisma);
  const communityRepo = new PrismaCommunityRepository(deps.prisma);
  const userRepo = new PrismaUserRepository(deps.prisma);
  const tournamentRepo = new PrismaTournamentRepository(deps.prisma);
  const liveResultRepo = new PrismaLiveResultRepository(deps.prisma);
  const ownerProvisioner = new PrismaImportOwnerProvisioner(deps.prisma);
  const arcadeRunRepo = new PrismaArcadeRunRepository(deps.prisma);
  const sheetParser = new ExceljsSheetParser();

  const baseContainer = createBaseContainer({
    betRepo,
    communityRepo,
    userRepo,
    tournamentRepo,
    liveResultRepo,
    ownerProvisioner,
    arcadeRunRepo,
    clock: deps.clock,
    betDeadline: deps.betDeadline,
    sheetParser,
  });

  return {
    ...baseContainer,
    async transaction<T>(
      callback: (
        txContainer: ReturnType<typeof createBaseContainer>,
      ) => Promise<T>,
    ): Promise<T> {
      return deps.prisma.$transaction(async (tx) => {
        const txContainer = createBaseContainer({
          betRepo: new PrismaBetRepository(tx),
          communityRepo: new PrismaCommunityRepository(tx),
          userRepo: new PrismaUserRepository(tx),
          tournamentRepo: new PrismaTournamentRepository(tx),
          liveResultRepo: new PrismaLiveResultRepository(tx),
          ownerProvisioner: new PrismaImportOwnerProvisioner(tx),
          arcadeRunRepo: new PrismaArcadeRunRepository(tx),
          clock: deps.clock,
          betDeadline: deps.betDeadline,
          sheetParser,
        });
        return callback(txContainer);
      });
    },
  };
}

/**
 * Factory to create a test Container backed by in-memory repositories
 * and mock adapters. Exposes transaction simulation via backup-and-restore.
 *
 * @param deps - Optional overrides for repositories, clock, and deadline
 */
export function createTestContainer(deps?: {
  betRepo?: InMemoryBetRepository;
  communityRepo?: InMemoryCommunityRepository;
  userRepo?: InMemoryUserRepository;
  tournamentRepo?: InMemoryTournamentRepository;
  liveResultRepo?: InMemoryLiveResultRepository;
  ownerProvisioner?: InMemoryImportOwnerProvisioner;
  arcadeRunRepo?: InMemoryArcadeRunRepository;
  clock?: () => Date;
  betDeadline?: Date;
  sheetParser?: SheetParser;
}): ReturnType<typeof createBaseContainer> & {
  transaction<T>(
    callback: (
      txContainer: ReturnType<typeof createBaseContainer>,
    ) => Promise<T>,
  ): Promise<T>;
} {
  const clock = deps?.clock ?? (() => new Date("2026-06-01T00:00:00Z"));
  const betDeadline = deps?.betDeadline ?? new Date("2026-06-11T19:00:00Z");

  const betRepo = deps?.betRepo ?? new InMemoryBetRepository();
  const communityRepo =
    deps?.communityRepo ?? new InMemoryCommunityRepository();
  const userRepo = deps?.userRepo ?? new InMemoryUserRepository();
  const tournamentRepo =
    deps?.tournamentRepo ?? new InMemoryTournamentRepository();
  const liveResultRepo =
    deps?.liveResultRepo ?? new InMemoryLiveResultRepository();
  const ownerProvisioner =
    deps?.ownerProvisioner ?? new InMemoryImportOwnerProvisioner();
  const arcadeRunRepo =
    deps?.arcadeRunRepo ?? new InMemoryArcadeRunRepository();
  const sheetParser = deps?.sheetParser ?? { parse: async () => [] };

  const baseContainer = createBaseContainer({
    betRepo,
    communityRepo,
    userRepo,
    tournamentRepo,
    liveResultRepo,
    ownerProvisioner,
    arcadeRunRepo,
    clock,
    betDeadline,
    sheetParser,
  });

  return {
    ...baseContainer,
    async transaction<T>(
      callback: (
        txContainer: ReturnType<typeof createBaseContainer>,
      ) => Promise<T>,
    ): Promise<T> {
      const betBackup = betRepo.getData();
      const communityBackup = communityRepo.getData();
      const userBackup = userRepo.getData();
      const tournamentBackup = tournamentRepo.getData();
      const liveResultBackup = liveResultRepo.getData();
      const ownerProvisionerBackup = ownerProvisioner.getData();
      const arcadeRunBackup = arcadeRunRepo.getData();

      try {
        const txContainer = createTestContainer({
          betRepo,
          communityRepo,
          userRepo,
          tournamentRepo,
          liveResultRepo,
          ownerProvisioner,
          arcadeRunRepo,
          clock,
          betDeadline,
          sheetParser,
        });
        return await callback(txContainer);
      } catch (error) {
        betRepo.setData(betBackup);
        communityRepo.setData(communityBackup);
        userRepo.setData(userBackup);
        tournamentRepo.setData(tournamentBackup);
        liveResultRepo.setData(liveResultBackup);
        ownerProvisioner.setData(ownerProvisionerBackup);
        arcadeRunRepo.setData(arcadeRunBackup);
        throw error;
      }
    },
  };
}

export const container = createContainer({
  prisma,
  clock: () => new Date(),
  betDeadline: BET_DEADLINE,
});
