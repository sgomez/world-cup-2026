import type { MatchContextResolver } from "./match-context-resolver";

/**
 * Stub MatchContextResolver for use in adapter tests.
 * Returns canned participants set via set(), null by default.
 */
export class StubMatchContextResolver implements MatchContextResolver {
  private readonly responses = new Map<
    number,
    { home: string; away: string } | null
  >();

  set(num: number, value: { home: string; away: string } | null) {
    this.responses.set(num, value);
  }

  resolveParticipants(num: number): { home: string; away: string } | null {
    return this.responses.get(num) ?? null;
  }

  async init(): Promise<void> {
    // no-op for stub
  }

  resetMemo(): void {
    // no-op for stub
  }
}
