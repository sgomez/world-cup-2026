import { err, ok, type Result } from "neverthrow";
import type { Match } from "@/modules/schedule";
import type { LiveFeed, LiveFeedSnapshot } from "../domain/live-feed";
import type { LiveResult } from "../domain/live-result";

/** Chrome-like User-Agent to send with each page request. */
const CHROME_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Request timeout in milliseconds. */
const FETCH_TIMEOUT_MS = 10_000;

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Extracts the scoreline from the fetched page HTML.
 *
 * The parsing contract is derived from the local, gitignored
 * `scripts/scrape-live-scores.mjs` (never committed, see ADR 0030).
 *
 * Returns `{ goals1, goals2, penalties1?, penalties2?, isLive }` when a
 * scoreline is found, or `null` when no score elements are present yet
 * (e.g. the real-world kickoff is delayed — caller treats this as still live).
 *
 * Penalties appear as bare parenthesised numbers after each score point,
 * e.g. `(3)` after the first score and `(4)` after the second:
 *
 *     <p class="score-board__content__score__point">1</p>
 *     (3)
 *     <span class="…__divider"></span>
 *     <p class="score-board__content__score__point">1</p>
 *     (4)
 */
function extractScore(html: string): {
  goals1: number;
  goals2: number;
  penalties1?: number;
  penalties2?: number;
  isLive: boolean;
} | null {
  const points = [
    ...html.matchAll(
      /<p class="score-board__content__score__point">\s*(\d+)\s*<\/p>/g,
    ),
  ];

  if (points.length < 2) {
    return null;
  }

  const result: {
    goals1: number;
    goals2: number;
    penalties1?: number;
    penalties2?: number;
    isLive: boolean;
  } = {
    goals1: parseInt(points[0][1], 10),
    goals2: parseInt(points[1][1], 10),
    isLive: html.includes("live-light"),
  };

  // Penalties: parenthesised number directly after each </p> of a
  // score-board__content__score__point element.  We match the full pattern
  // so we only pick up penalty markers adjacent to score points.
  const penMatches = [
    ...html.matchAll(
      /<p class="score-board__content__score__point">\s*\d+\s*<\/p>\s*\((\d+)\)/g,
    ),
  ];
  if (penMatches.length === 2) {
    result.penalties1 = parseInt(penMatches[0][1], 10);
    result.penalties2 = parseInt(penMatches[1][1], 10);
  }

  return result;
}

/**
 * Real Live Feed that fetches each match's current scoreline from the
 * external page stored as its Match Link. Source-agnostic: no URL or
 * provider name lives in committed code (ADR 0030).
 *
 * Snapshot mapping:
 * - parseable scoreline + live indicator → `finished:false` + page goals
 * - parseable scoreline + no live indicator → `finished:true` + page goals
 * - no parseable scoreline yet → `finished:false` + echoed current goals
 *   (protects a delayed real-world kickoff from a false full-time 0-0)
 *
 * A missing Match Link, a non-success HTTP status, an unreachable host,
 * or an unparseable response all return `Err` — the Tick logs the error
 * and retries next cycle.
 *
 * Penalties are extracted from the page when present (parenthesised numbers
 * next to each score point). When absent from the page they are left
 * undefined, letting the upsert layer decide whether to clear or preserve.
 */
export class RemoteLiveFeed implements LiveFeed {
  constructor(private readonly fetchFn: FetchFn = fetch) {}

  async fetchSnapshot(
    _match: Match,
    current: LiveResult | null,
  ): Promise<Result<LiveFeedSnapshot, Error>> {
    if (!current?.link) {
      return err(
        new Error(
          `Match ${_match.num} has no Match Link — skipping until a link is seeded`,
        ),
      );
    }

    const { link } = current;

    let html: string;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      let response: Response;
      try {
        response = await this.fetchFn(link, {
          headers: { "User-Agent": CHROME_UA },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        return err(
          new Error(
            `Failed to fetch match page for match ${_match.num}: HTTP ${response.status}`,
          ),
        );
      }

      html = await response.text();
    } catch (e) {
      return err(
        e instanceof Error
          ? e
          : new Error(`Unexpected error fetching match ${_match.num}: ${e}`),
      );
    }

    const score = extractScore(html);

    if (score === null) {
      // No scoreline parsed yet — real-world kickoff may be delayed.
      // Treat as still live and echo current goals to avoid false full-time.
      return ok({
        goals1: current.goals1,
        goals2: current.goals2,
        finished: false,
        penalties1: current.penalties1,
        penalties2: current.penalties2,
      });
    }

    return ok({
      goals1: score.goals1,
      goals2: score.goals2,
      finished: !score.isLive,
      penalties1: score.penalties1,
      penalties2: score.penalties2,
    });
  }
}
