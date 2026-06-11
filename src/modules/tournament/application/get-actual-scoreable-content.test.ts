import { describe, expect, it } from "vitest";
import { InMemoryLiveResultRepository } from "@/modules/live/infrastructure/in-memory-live-result-repository";
import { InMemoryTournamentRepository } from "../infrastructure/in-memory-tournament-repository";
import { getActualScoreableContent } from "./get-actual-scoreable-content";

describe("getActualScoreableContent", () => {
  it("returns an empty key when no LiveResults exist", async () => {
    const tournamentRepo = new InMemoryTournamentRepository();
    const liveResultRepo = new InMemoryLiveResultRepository();

    const result = await getActualScoreableContent(
      tournamentRepo,
      liveResultRepo,
    );

    expect(result.R32).toEqual([]);
    expect(result.R16).toEqual([]);
    expect(result.QF).toEqual([]);
    expect(result.SF).toEqual([]);
    expect(result.F).toEqual([]);
    expect(result.champion).toBeNull();
    expect(result.thirdPlace).toBeNull();
  });
});
