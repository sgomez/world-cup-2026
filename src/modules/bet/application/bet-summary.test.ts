import { describe, expect, it } from "vitest";
import { Bet, type BetState } from "../domain/bet";
import { toSummary } from "./bet-summary";

const BASE: BetState = {
  id: "bet-1",
  userId: "user-1",
  status: "draft",
  label: "My Bet",
  groupPredictions: null,
  knockoutWinners: {},
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
};

function completeWinners(): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: 32 }, (_, i) => [`M${i}`, `team-${i}`]),
  );
}

describe("toSummary", () => {
  it("maps a draft bet with no signature", () => {
    const bet = Bet.fromState({ ...BASE, status: "draft" });
    const summary = toSummary(bet);
    expect(summary.id).toBe("bet-1");
    expect(summary.label).toBe("My Bet");
    expect(summary.status).toBe("draft");
    expect(summary.signature).toBeUndefined();
  });

  it("maps a closed bet with a string signature", () => {
    const bet = Bet.fromState({
      ...BASE,
      status: "closed",
      knockoutWinners: completeWinners(),
    });
    const summary = toSummary(bet);
    expect(summary.status).toBe("closed");
    expect(typeof summary.signature).toBe("string");
    expect(summary.signature!.length).toBeGreaterThan(0);
  });

  it("passes timestamps through unchanged", () => {
    const bet = Bet.fromState({ ...BASE });
    const summary = toSummary(bet);
    expect(summary.createdAt).toEqual(new Date("2026-01-01T00:00:00Z"));
    expect(summary.updatedAt).toEqual(new Date("2026-01-02T00:00:00Z"));
  });
});
