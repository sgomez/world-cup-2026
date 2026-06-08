import { describe, expect, it } from "vitest";
import { Tournament } from "./tournament";

describe("Tournament aggregate", () => {
  it("initializes lazily with createDefault", () => {
    const t = Tournament.createDefault();
    expect(t.id).toBe("singleton");
    expect(t.result).toBeNull();
    expect(t.advancement).toEqual([]);
  });

  it("can mark and unmark slots as Advanced", () => {
    let t = Tournament.createDefault();

    // Valid refs
    const res1 = t.markAdvanced("1A");
    expect(res1.isOk()).toBe(true);
    t = res1._unsafeUnwrap();
    expect(t.advancement).toContain("1A");

    const res2 = t.markAdvanced("3rd-1E");
    expect(res2.isOk()).toBe(true);
    t = res2._unsafeUnwrap();
    expect(t.advancement).toContain("3rd-1E");

    // Invalid ref
    const res3 = t.markAdvanced("9Z");
    expect(res3.isErr()).toBe(true);
    expect(res3._unsafeUnwrapErr().code).toBe("INVALID_REF");

    // Unmark
    const res4 = t.unmarkAdvanced("1A");
    expect(res4.isOk()).toBe(true);
    t = res4._unsafeUnwrap();
    expect(t.advancement).not.toContain("1A");
    expect(t.advancement).toContain("3rd-1E");
  });

  it("bracketView resolves R32 teams only if they are Advanced, otherwise TBD (null)", () => {
    let t = Tournament.createDefault();
    // Initially everything is null/TBD because advancement is empty
    let bracket = t.bracketView();
    expect(bracket["R32-73"].team1Id).toBeNull(); // 2A is TBD
    expect(bracket["R32-73"].team2Id).toBeNull(); // 2B is TBD

    // Let's mark 2A and 2B as Advanced
    t = t.markAdvanced("2A")._unsafeUnwrap();
    t = t.markAdvanced("2B")._unsafeUnwrap();

    bracket = t.bracketView();
    // Now they should be resolved (default teams for group A and B runner-ups)
    expect(bracket["R32-73"].team1Id).not.toBeNull();
    expect(bracket["R32-73"].team2Id).not.toBeNull();
  });

  it("clears advanced flags on group order changes if occupant changes, and preserves them otherwise", () => {
    let t = Tournament.createDefault();

    // Let's mark 1A and 2A as advanced
    t = t.markAdvanced("1A")._unsafeUnwrap();
    t = t.markAdvanced("2A")._unsafeUnwrap();
    t = t.markAdvanced("1B")._unsafeUnwrap();

    // Default occupant of 1A and 2A
    const _initialResult = t.toState().result;
    expect(t.advancement).toContain("1A");
    expect(t.advancement).toContain("2A");
    expect(t.advancement).toContain("1B");

    // Let's change group A order: swap 1st and 2nd teams
    const _defaultGroupA = ["usa", "wal", "irn", "eng"]; // Example default group A teams or similar
    // Let's get the actual default teams for Group A
    const _state = t.toState();
    // biome-ignore lint/complexity/useLiteralKeys: test access to private method
    const currentA = t["getEffectiveResult"]().groupOrders.A;

    // Swap 1st and 2nd
    const newA = [currentA[1], currentA[0], currentA[2], currentA[3]];

    // Set Group A order
    t = t.setGroupOrder("A", newA)._unsafeUnwrap();

    // Since the team occupant at 1A and 2A changed, their advanced flags must be cleared!
    expect(t.advancement).not.toContain("1A");
    expect(t.advancement).not.toContain("2A");
    // 1B occupant did not change, so it should be preserved
    expect(t.advancement).toContain("1B");
  });

  it("cascades knockout winners when group standings or knockout winners are edited", () => {
    let t = Tournament.createDefault();
    // biome-ignore lint/complexity/useLiteralKeys: test access to private method
    const currentResult = t["getEffectiveResult"]();

    // Let's set a knockout winner for R32-73 (2A vs 2B)
    // First mark 2A and 2B advanced so they occupy the match
    t = t.markAdvanced("2A")._unsafeUnwrap();
    t = t.markAdvanced("2B")._unsafeUnwrap();

    const team2A = currentResult.groupOrders.A[1];
    const _team2B = currentResult.groupOrders.B[1];

    t = t.setKnockoutWinner("R32-73", team2A)._unsafeUnwrap();
    expect(t.result?.knockoutWinners["R32-73"]).toBe(team2A);

    // Let's swap the runner-up of Group A (changing occupant of 2A)
    const currentA = currentResult.groupOrders.A;
    const newA = [currentA[0], currentA[2], currentA[1], currentA[3]]; // Change 2nd place team

    t = t.setGroupOrder("A", newA)._unsafeUnwrap();

    // The occupant of 2A changed, so the R32-73 winner (team2A) must be cleared!
    expect(t.result?.knockoutWinners["R32-73"]).toBeUndefined();
    // And 2A advanced flag must be cleared
    expect(t.advancement).not.toContain("2A");
    // 2B did not change, so its advanced flag should be preserved
    expect(t.advancement).toContain("2B");
  });
});
