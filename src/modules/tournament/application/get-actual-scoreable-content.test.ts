import { describe, expect, it } from "vitest";
import { Tournament } from "../domain/tournament";
import { InMemoryTournamentRepository } from "../infrastructure/in-memory-tournament-repository";
import { getActualScoreableContent } from "./get-actual-scoreable-content";

describe("getActualScoreableContent", () => {
  it("returns an empty key when no Result/Tournament exists", async () => {
    const repo = new InMemoryTournamentRepository();
    const result = await getActualScoreableContent(repo);

    expect(result.R32).toEqual([]);
    expect(result.R16).toEqual([]);
    expect(result.QF).toEqual([]);
    expect(result.SF).toEqual([]);
    expect(result.F).toEqual([]);
    expect(result.champion).toBeNull();
    expect(result.thirdPlace).toBeNull();
  });

  it("returns correct sets when populated and excludes an un-Advanced R32 team", async () => {
    // We create a tournament, mark 1A as advanced, but keep 2A un-advanced.
    // 1A corresponds to R32 slot 1 (R32-1 team1).
    // R32-1 is matchup 1A vs 2B. Since 1A is advanced, it should be in R32 set.
    // Since 2B is not advanced, it should not be in R32 set.
    let tournament = Tournament.createDefault();
    tournament = tournament.markAdvanced("1A")._unsafeUnwrap();

    const repo = new InMemoryTournamentRepository(tournament);
    const result = await getActualScoreableContent(repo);

    // 1A occupant should be in R32.
    // Default group orders should populate the occupant.
    // Let's look at the result.R32: it should have size 1.
    expect(result.R32.length).toBe(1);

    // Check that it's the group A winner (MEX is the default group A winner in worldcup teams data).
    const groupAWinner = "MEX";
    expect(result.R32).toContain(groupAWinner);

    // Other rounds must be empty.
    expect(result.R16).toEqual([]);
    expect(result.champion).toBeNull();
  });
});
