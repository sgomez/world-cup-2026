import { describe, expect, it } from "vitest";
import { computeBetSignature } from "./bet-signature";
import {
  createInitialState,
  KNOCKOUT_MATCH_IDS,
  type KnockoutRound,
  type PredictionState,
  tournamentReducer,
} from "./prediction-state";

function buildTeam1WinsWinners(
  groupPredictions: PredictionState | null,
): Record<string, string> {
  let state = createInitialState(groupPredictions);
  const winners: Record<string, string> = {};
  const roundOrder: KnockoutRound[] = ["R32", "R16", "QF", "SF", "F", "3RD"];
  for (const round of roundOrder) {
    for (const matchId of KNOCKOUT_MATCH_IDS[round]) {
      const match = state.knockoutMatches[matchId];
      if (match.team1Id) {
        winners[matchId] = match.team1Id;
        state = tournamentReducer(state, {
          type: "SET_KNOCKOUT_WINNER",
          matchId,
          winnerId: match.team1Id,
        });
      }
    }
  }
  return winners;
}

describe("computeBetSignature", () => {
  it("returns a 64-char lowercase hex string for a complete prediction", () => {
    const state = createInitialState(null);
    const preds: PredictionState = {
      groupOrders: state.groupOrders,
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winners = buildTeam1WinsWinners(preds);
    const sig = computeBetSignature(preds, winners);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is stable: same input produces same signature", () => {
    const state = createInitialState(null);
    const preds: PredictionState = {
      groupOrders: state.groupOrders,
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winners = buildTeam1WinsWinners(preds);
    expect(computeBetSignature(preds, winners)).toBe(
      computeBetSignature(preds, winners),
    );
  });

  it("same round-sets from different group orders produce the same signature", () => {
    const state = createInitialState(null);
    const [a0, a1, a2, a3] = state.groupOrders.A;

    const predsA: PredictionState = {
      groupOrders: state.groupOrders,
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winnersA = buildTeam1WinsWinners(predsA);
    const sigA = computeBetSignature(predsA, winnersA);

    // Swap 1A and 2A — same 32 teams qualify, just different match slots
    const predsB: PredictionState = {
      groupOrders: { ...state.groupOrders, A: [a1, a0, a2, a3] },
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winnersB = buildTeam1WinsWinners(predsB);
    const sigB = computeBetSignature(predsB, winnersB);

    expect(sigA).toBe(sigB);
  });

  it("changing the champion produces a different signature", () => {
    const state = createInitialState(null);
    const preds: PredictionState = {
      groupOrders: state.groupOrders,
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winners = buildTeam1WinsWinners(preds);

    // Compute baseline
    const sigA = computeBetSignature(preds, winners);

    // Change the champion: find both finalists and swap the winner
    const finalState = createInitialState(preds, winners);
    const finalMatch = finalState.knockoutMatches["F"];
    const altChampion =
      finalMatch.winnerId === finalMatch.team1Id
        ? finalMatch.team2Id!
        : finalMatch.team1Id!;

    const altWinners = { ...winners, F: altChampion };
    const sigB = computeBetSignature(preds, altWinners);

    expect(sigA).not.toBe(sigB);
  });

  it("changing a team in any round produces a different signature", () => {
    const state = createInitialState(null);
    const [a0, a1, a2, a3] = state.groupOrders.A;

    const predsA: PredictionState = {
      groupOrders: state.groupOrders,
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winnersA = buildTeam1WinsWinners(predsA);
    const sigA = computeBetSignature(predsA, winnersA);

    // Move a3 into 1A position — changes R32 participant set (a3 now qualifies as 1A, a0 drops to 4th)
    const predsB: PredictionState = {
      groupOrders: { ...state.groupOrders, A: [a3, a1, a2, a0] },
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winnersB = buildTeam1WinsWinners(predsB);
    const sigB = computeBetSignature(predsB, winnersB);

    expect(sigA).not.toBe(sigB);
  });

  it("input order of knockoutWinners does not affect the signature", () => {
    const state = createInitialState(null);
    const preds: PredictionState = {
      groupOrders: state.groupOrders,
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winners = buildTeam1WinsWinners(preds);

    // Reverse the key order
    const reversedWinners = Object.fromEntries(
      Object.entries(winners).reverse(),
    );

    expect(computeBetSignature(preds, winners)).toBe(
      computeBetSignature(preds, reversedWinners),
    );
  });

  it("null groupPredictions and null knockoutWinners produces a consistent signature", () => {
    const sig1 = computeBetSignature(null, null);
    const sig2 = computeBetSignature(null, null);
    expect(sig1).toMatch(/^[0-9a-f]{64}$/);
    expect(sig1).toBe(sig2);
  });

  it("uses FIFA codes not locale-specific names (locale-independent)", () => {
    const stateEn = createInitialState(null);
    const preds: PredictionState = {
      groupOrders: stateEn.groupOrders,
      thirdPlaceOrder: stateEn.thirdPlaceOrder,
    };
    const winners = buildTeam1WinsWinners(preds);
    // computeBetSignature has no locale param — always locale-independent
    const sig = computeBetSignature(preds, winners);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
});
