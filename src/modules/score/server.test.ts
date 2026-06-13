import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createInitialState,
  KNOCKOUT_MATCH_IDS,
  type KnockoutRound,
  type PredictionState,
} from "@/modules/bracket";
import { tournamentReducer } from "@/modules/bracket/prediction-ui";
import { extractScoreableContent } from "./index";
import { signature } from "./server";

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

function contentFromPredictions(
  groupPredictions: PredictionState | null,
  knockoutWinners: Record<string, string> | null,
) {
  const { knockoutMatches } = createInitialState(
    groupPredictions,
    knockoutWinners ?? {},
  );
  return extractScoreableContent(knockoutMatches);
}

describe("signature", () => {
  it("returns a 64-char lowercase hex string for a complete prediction", () => {
    const state = createInitialState(null);
    const preds: PredictionState = {
      groupOrders: state.groupOrders,
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winners = buildTeam1WinsWinners(preds);
    const content = contentFromPredictions(preds, winners);
    const sig = signature(content);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is stable: same input produces same signature", () => {
    const state = createInitialState(null);
    const preds: PredictionState = {
      groupOrders: state.groupOrders,
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winners = buildTeam1WinsWinners(preds);
    const content = contentFromPredictions(preds, winners);
    expect(signature(content)).toBe(signature(content));
  });

  it("same round-sets from different group orders produce the same signature", () => {
    const state = createInitialState(null);
    const [a0, a1, a2, a3] = state.groupOrders.A;

    const predsA: PredictionState = {
      groupOrders: state.groupOrders,
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winnersA = buildTeam1WinsWinners(predsA);
    const sigA = signature(contentFromPredictions(predsA, winnersA));

    // Swap 1A and 2A — same 32 teams qualify, just different match slots
    const predsB: PredictionState = {
      groupOrders: { ...state.groupOrders, A: [a1, a0, a2, a3] },
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winnersB = buildTeam1WinsWinners(predsB);
    const sigB = signature(contentFromPredictions(predsB, winnersB));

    expect(sigA).toBe(sigB);
  });

  it("changing the champion produces a different signature", () => {
    const state = createInitialState(null);
    const preds: PredictionState = {
      groupOrders: state.groupOrders,
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winners = buildTeam1WinsWinners(preds);
    const sigA = signature(contentFromPredictions(preds, winners));

    // Change the champion: find both finalists and swap the winner
    const finalState = createInitialState(preds, winners);
    const finalMatch = finalState.knockoutMatches.F;
    const altChampion =
      finalMatch.winnerId === finalMatch.team1Id
        ? finalMatch.team2Id!
        : finalMatch.team1Id!;

    const altWinners = { ...winners, F: altChampion };
    const sigB = signature(contentFromPredictions(preds, altWinners));

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
    const sigA = signature(contentFromPredictions(predsA, winnersA));

    // Move a3 into 1A position — changes R32 participant set
    const predsB: PredictionState = {
      groupOrders: { ...state.groupOrders, A: [a3, a1, a2, a0] },
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winnersB = buildTeam1WinsWinners(predsB);
    const sigB = signature(contentFromPredictions(predsB, winnersB));

    expect(sigA).not.toBe(sigB);
  });

  it("null groupPredictions and null knockoutWinners produces a consistent signature", () => {
    const content = contentFromPredictions(null, null);
    const sig1 = signature(content);
    const sig2 = signature(content);
    expect(sig1).toMatch(/^[0-9a-f]{64}$/);
    expect(sig1).toBe(sig2);
  });

  it("changing the 3rd-place winner produces a different signature", () => {
    const state = createInitialState(null);
    const preds: PredictionState = {
      groupOrders: state.groupOrders,
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winners = buildTeam1WinsWinners(preds);
    const sigA = signature(contentFromPredictions(preds, winners));

    const fullState = createInitialState(preds, winners);
    const thirdMatch = fullState.knockoutMatches["3RD"];
    const alt3rd =
      thirdMatch.winnerId === thirdMatch.team1Id
        ? thirdMatch.team2Id!
        : thirdMatch.team1Id!;

    const altWinners = { ...winners, "3RD": alt3rd };
    const sigB = signature(contentFromPredictions(preds, altWinners));

    expect(sigA).not.toBe(sigB);
  });

  describe("with secret salt", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("uses the salt from environment variable and is stable", () => {
      process.env.BET_SIGNATURE_SALT = "secret-salt-123";

      const state = createInitialState(null);
      const preds: PredictionState = {
        groupOrders: state.groupOrders,
        thirdPlaceOrder: state.thirdPlaceOrder,
      };
      const winners = buildTeam1WinsWinners(preds);
      const content = contentFromPredictions(preds, winners);

      const sig1 = signature(content);
      const sig2 = signature(content);

      expect(sig1).toMatch(/^[0-9a-f]{64}$/);
      expect(sig1).toBe(sig2);
    });

    it("produces different signatures with different salts", () => {
      const state = createInitialState(null);
      const preds: PredictionState = {
        groupOrders: state.groupOrders,
        thirdPlaceOrder: state.thirdPlaceOrder,
      };
      const winners = buildTeam1WinsWinners(preds);
      const content = contentFromPredictions(preds, winners);

      process.env.BET_SIGNATURE_SALT = "salt-a";
      const sigA = signature(content);

      process.env.BET_SIGNATURE_SALT = "salt-b";
      const sigB = signature(content);

      process.env.BET_SIGNATURE_SALT = "";
      const sigNoSalt = signature(content);

      expect(sigA).not.toBe(sigB);
      expect(sigA).not.toBe(sigNoSalt);
      expect(sigB).not.toBe(sigNoSalt);
    });

    it("preserves copy detection (identical content yields identical signature under same salt)", () => {
      process.env.BET_SIGNATURE_SALT = "secret-salt-123";

      const state = createInitialState(null);
      const [a0, a1, a2, a3] = state.groupOrders.A;

      const predsA: PredictionState = {
        groupOrders: state.groupOrders,
        thirdPlaceOrder: state.thirdPlaceOrder,
      };
      const winnersA = buildTeam1WinsWinners(predsA);
      const sigA = signature(contentFromPredictions(predsA, winnersA));

      // Swap 1A and 2A — same 32 teams qualify, just different match slots
      const predsB: PredictionState = {
        groupOrders: { ...state.groupOrders, A: [a1, a0, a2, a3] },
        thirdPlaceOrder: state.thirdPlaceOrder,
      };
      const winnersB = buildTeam1WinsWinners(predsB);
      const sigB = signature(contentFromPredictions(predsB, winnersB));

      expect(sigA).toBe(sigB);
    });
  });
});
