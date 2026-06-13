import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Bet } from "@/modules/bet/domain/bet";
import { toScoreableContentArrays } from "@/modules/score";
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
    const finalMatch = finalState.knockoutMatches.F;
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

  it("returns valid hex for default prediction", () => {
    const stateEn = createInitialState(null);
    const preds: PredictionState = {
      groupOrders: stateEn.groupOrders,
      thirdPlaceOrder: stateEn.thirdPlaceOrder,
    };
    const winners = buildTeam1WinsWinners(preds);
    const sig = computeBetSignature(preds, winners);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changing the 3rd-place winner produces a different signature", () => {
    const state = createInitialState(null);
    const preds: PredictionState = {
      groupOrders: state.groupOrders,
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winners = buildTeam1WinsWinners(preds);

    const sigA = computeBetSignature(preds, winners);

    const fullState = createInitialState(preds, winners);
    const thirdMatch = fullState.knockoutMatches["3RD"];
    const alt3rd =
      thirdMatch.winnerId === thirdMatch.team1Id
        ? thirdMatch.team2Id!
        : thirdMatch.team1Id!;

    const altWinners = { ...winners, "3RD": alt3rd };
    const sigB = computeBetSignature(preds, altWinners);

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

      const sig1 = computeBetSignature(preds, winners);
      const sig2 = computeBetSignature(preds, winners);

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

      process.env.BET_SIGNATURE_SALT = "salt-a";
      const sigA = computeBetSignature(preds, winners);

      process.env.BET_SIGNATURE_SALT = "salt-b";
      const sigB = computeBetSignature(preds, winners);

      process.env.BET_SIGNATURE_SALT = "";
      const sigNoSalt = computeBetSignature(preds, winners);

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
  });
});

describe("Bet aggregate signature equivalence", () => {
  it("produces a signature byte-identical to computeBetSignature for closed bets", () => {
    const state = createInitialState(null);
    const preds = {
      groupOrders: state.groupOrders,
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winners = buildTeam1WinsWinners(preds);
    const bet = Bet.fromState({
      id: "1",
      userId: "user-1",
      label: "test",
      status: "closed",
      groupPredictions: preds,
      knockoutWinners: winners,
    });
    expect(bet.signature).toBe(computeBetSignature(preds, winners));
  });

  it("returns undefined signature for non-closed bets", () => {
    const bet = Bet.fromState({
      id: "2",
      userId: "user-1",
      label: "draft",
      status: "draft",
      groupPredictions: null,
      knockoutWinners: {},
    });
    expect(bet.signature).toBeUndefined();
  });

  it("produces identical signatures for a Direct Bet and a Bracket Bet with same predictions", () => {
    const state = createInitialState(null);
    const preds = {
      groupOrders: state.groupOrders,
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winners = buildTeam1WinsWinners(preds);
    const bracketBet = Bet.fromState({
      id: "bracket-bet",
      userId: "user-1",
      label: "bracket",
      status: "closed",
      groupPredictions: preds,
      knockoutWinners: winners,
    });

    const arrays = toScoreableContentArrays(bracketBet.scoreableContent());
    const directBet = Bet.createDirect(
      "direct",
      "user-1",
      arrays,
    )._unsafeUnwrap();

    expect(directBet.signature).toBe(bracketBet.signature);
  });

  it("Direct Bet signature is case-insensitive in the input team ids", () => {
    const state = createInitialState(null);
    const preds = {
      groupOrders: state.groupOrders,
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winners = buildTeam1WinsWinners(preds);
    const bracketBet = Bet.fromState({
      id: "bracket-bet",
      userId: "user-1",
      label: "bracket",
      status: "closed",
      groupPredictions: preds,
      knockoutWinners: winners,
    });
    const base = toScoreableContentArrays(bracketBet.scoreableContent());

    const toCase = (transform: (id: string) => string) => ({
      R32: base.R32.map(transform),
      R16: base.R16.map(transform),
      QF: base.QF.map(transform),
      SF: base.SF.map(transform),
      F: base.F.map(transform),
      champion: base.champion ? transform(base.champion) : null,
      thirdPlace: base.thirdPlace ? transform(base.thirdPlace) : null,
    });

    const upper = Bet.createDirect(
      "upper",
      "user-1",
      toCase((id) => id.toUpperCase()),
    )._unsafeUnwrap();
    const lower = Bet.createDirect(
      "lower",
      "user-1",
      toCase((id) => id.toLowerCase()),
    )._unsafeUnwrap();

    expect(lower.signature).toBe(upper.signature);
  });

  it("Direct Bet signature is independent of the input team order within each round", () => {
    const state = createInitialState(null);
    const preds = {
      groupOrders: state.groupOrders,
      thirdPlaceOrder: state.thirdPlaceOrder,
    };
    const winners = buildTeam1WinsWinners(preds);
    const bracketBet = Bet.fromState({
      id: "bracket-bet",
      userId: "user-1",
      label: "bracket",
      status: "closed",
      groupPredictions: preds,
      knockoutWinners: winners,
    });
    const base = toScoreableContentArrays(bracketBet.scoreableContent());

    const reversed = {
      R32: [...base.R32].reverse(),
      R16: [...base.R16].reverse(),
      QF: [...base.QF].reverse(),
      SF: [...base.SF].reverse(),
      F: [...base.F].reverse(),
      champion: base.champion,
      thirdPlace: base.thirdPlace,
    };

    const ordered = Bet.createDirect("ordered", "user-1", base)._unsafeUnwrap();
    const shuffled = Bet.createDirect(
      "shuffled",
      "user-1",
      reversed,
    )._unsafeUnwrap();

    expect(shuffled.signature).toBe(ordered.signature);
  });
});
