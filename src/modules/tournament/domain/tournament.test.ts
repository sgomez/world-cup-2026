import { describe, expect, it } from "vitest";
import { LiveResult } from "@/modules/live/domain/live-result";
import { Tournament } from "./tournament";

describe("Tournament aggregate", () => {
  it("initializes with createDefault — no stored tie-breaks", () => {
    const t = Tournament.createDefault();
    expect(t.id).toBe("singleton");
    expect(t.manualTieBreaks).toEqual({});
    expect(t.thirdPlaceManualOrder).toBeNull();
  });

  it("stores and clears a per-group manual tie-break", () => {
    let t = Tournament.createDefault();

    t = t.setManualTieBreak("A", ["mex", "kor"])._unsafeUnwrap();
    expect(t.manualTieBreaks.A).toEqual(["mex", "kor"]);

    t = t.setManualTieBreak("B", ["can", "sui"])._unsafeUnwrap();
    expect(t.manualTieBreaks.B).toEqual(["can", "sui"]);
    expect(t.manualTieBreaks.A).toEqual(["mex", "kor"]);

    t = t.clearManualTieBreak("A")._unsafeUnwrap();
    expect(t.manualTieBreaks.A).toBeUndefined();
    expect(t.manualTieBreaks.B).toEqual(["can", "sui"]);
  });

  it("stores and clears the thirds manual order", () => {
    let t = Tournament.createDefault();

    t = t.setThirdPlaceManualOrder(["mex", "kor", "can"])._unsafeUnwrap();
    expect(t.thirdPlaceManualOrder).toEqual(["mex", "kor", "can"]);

    t = t.setThirdPlaceManualOrder(null)._unsafeUnwrap();
    expect(t.thirdPlaceManualOrder).toBeNull();
  });

  it("bracketView returns all nulls when no LiveResults exist", () => {
    const t = Tournament.createDefault();
    const bracket = t.bracketView([]);
    // No groups settled → all bracket positions are TBD (null)
    expect(bracket["R32-73"].team1Id).toBeNull();
    expect(bracket["R32-73"].team2Id).toBeNull();
    expect(bracket["F"].winnerId).toBeNull();
  });

  it("isCompetitionEnded returns false when no LiveResults", () => {
    const t = Tournament.createDefault();
    expect(t.isCompetitionEnded([])).toBe(false);
  });

  it("isCompetitionEnded returns true when matches 103 and 104 are both finished", () => {
    const t = Tournament.createDefault();
    const lr103 = LiveResult.fromState({
      num: 103,
      status: "finished",
      goals1: 1,
      goals2: 0,
    });
    const lr104 = LiveResult.fromState({
      num: 104,
      status: "finished",
      goals1: 2,
      goals2: 1,
    });
    expect(t.isCompetitionEnded([lr103, lr104])).toBe(true);
    expect(t.isCompetitionEnded([lr103])).toBe(false);
    expect(t.isCompetitionEnded([lr104])).toBe(false);
    expect(t.isCompetitionEnded([])).toBe(false);
  });

  it("toState / fromState round-trips correctly", () => {
    const t = Tournament.fromState({
      id: "singleton",
      manualTieBreaks: { A: ["mex", "kor"] },
      thirdPlaceManualOrder: ["mex", "bra"],
    });
    expect(t.toState()).toEqual({
      id: "singleton",
      manualTieBreaks: { A: ["mex", "kor"] },
      thirdPlaceManualOrder: ["mex", "bra"],
    });
  });
});
