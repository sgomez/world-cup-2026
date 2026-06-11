import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import type { Match } from "@/lib/matches";
import type { Clock } from "../domain/clock";
import type { LiveFeed, LiveFeedSnapshot } from "../domain/live-feed";
import type { LiveResult } from "../domain/live-result";

const apiGameSchema = z.object({
  id: z.string(),
  home_score: z.string(),
  away_score: z.string(),
  finished: z.string(),
  group: z.string(),
  time_elapsed: z.string(),
});

const apiResponseSchema = z.object({
  games: z.array(apiGameSchema),
});

type ApiGame = z.infer<typeof apiGameSchema>;

function groupsAgree(
  fixtureGroup: string | undefined,
  apiGroup: string,
): boolean {
  const normalizedApi = apiGroup.replace("Group ", "").trim().toUpperCase();
  if (!fixtureGroup) {
    // Fixture has no group (knockout stage).
    // API group should be one of the knockout identifiers, NOT a group stage letter.
    const knockoutGroups = ["R32", "R16", "QF", "SF", "3RD", "FINAL"];
    return knockoutGroups.includes(normalizedApi);
  }
  const normalizedFixture = fixtureGroup
    .replace("Group ", "")
    .trim()
    .toUpperCase();
  return normalizedFixture === normalizedApi;
}

export class Worldcup26LiveFeed implements LiveFeed {
  private cachedGames: Map<number, ApiGame> | null = null;
  private lastFetchTime: number = 0;
  private fetchPromise: Promise<Result<Map<number, ApiGame>, Error>> | null =
    null;

  constructor(
    private readonly baseUrl: string,
    private readonly clock: Clock,
    private readonly fetchFn: typeof fetch = globalThis.fetch,
  ) {}

  private async getGamesMap(): Promise<Result<Map<number, ApiGame>, Error>> {
    const now = this.clock.now().getTime();
    if (this.cachedGames && now - this.lastFetchTime < 60000) {
      return ok(this.cachedGames);
    }

    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = this.fetchGames().then((res) => {
      this.fetchPromise = null;
      if (res.isOk()) {
        this.cachedGames = res.value;
        this.lastFetchTime = this.clock.now().getTime();
      }
      return res;
    });

    return this.fetchPromise;
  }

  private async fetchGames(): Promise<Result<Map<number, ApiGame>, Error>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const url = `${this.baseUrl.replace(/\/$/, "")}/get/games`;
      const response = await this.fetchFn(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return err(new Error(`HTTP error! status: ${response.status}`));
      }

      const json = await response.json();
      const parseResult = apiResponseSchema.safeParse(json);
      if (!parseResult.success) {
        return err(
          new Error(`Invalid API response shape: ${parseResult.error.message}`),
        );
      }

      const gamesMap = new Map<number, ApiGame>();
      for (const game of parseResult.data.games) {
        const num = parseInt(game.id, 10);
        if (!Number.isNaN(num)) {
          gamesMap.set(num, game);
        }
      }

      return ok(gamesMap);
    } catch (e) {
      clearTimeout(timeoutId);
      return err(
        e instanceof Error ? e : new Error(`Network request failed: ${e}`),
      );
    }
  }

  async fetchSnapshot(
    match: Match,
    current: LiveResult | null,
  ): Promise<Result<LiveFeedSnapshot, Error>> {
    const gamesRes = await this.getGamesMap();
    if (gamesRes.isErr()) {
      return err(gamesRes.error);
    }

    const gamesMap = gamesRes.value;
    const game = gamesMap.get(match.num);
    if (!game) {
      return err(new Error(`Match ${match.num} not found in live feed`));
    }

    // Perform group validation
    if (!groupsAgree(match.group, game.group)) {
      console.warn(
        `[Worldcup26LiveFeed] Group mismatch for match ${match.num}. Fixture: ${match.group}, Feed: ${game.group}. Skipping.`,
      );
      return err(new Error(`Group mismatch for match ${match.num}`));
    }

    const goals1 = parseInt(game.home_score, 10);
    const goals2 = parseInt(game.away_score, 10);
    if (Number.isNaN(goals1) || Number.isNaN(goals2)) {
      return err(
        new Error(
          `Invalid score values for match ${match.num}: ${game.home_score}-${game.away_score}`,
        ),
      );
    }

    const finished = game.finished === "TRUE";

    return ok({
      goals1,
      goals2,
      finished,
      penalties1: current?.penalties1,
      penalties2: current?.penalties2,
    });
  }
}
