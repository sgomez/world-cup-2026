import type { Bet, BetStatus } from "../domain/bet";

export type BetSummary = {
  id: string;
  label: string;
  status: BetStatus;
  /** Always present — persisted Bets always have DB-managed timestamps. */
  createdAt: Date;
  /** Always present — persisted Bets always have DB-managed timestamps. */
  updatedAt: Date;
  /** String for a closed Bet; absent for a draft. */
  signature: string | undefined;
};

/**
 * Pure projection from the Bet aggregate to the read view.
 *
 * Timestamps are non-null asserted: persisted Bets always have DB-managed
 * createdAt/updatedAt; the aggregate types them optional only for the
 * not-yet-persisted create path.
 */
export function toSummary(bet: Bet): BetSummary {
  return {
    id: bet.id,
    label: bet.label,
    status: bet.status,
    // biome-ignore lint/style/noNonNullAssertion: persisted Bets always have DB-managed timestamps
    createdAt: bet.createdAt!,
    // biome-ignore lint/style/noNonNullAssertion: persisted Bets always have DB-managed timestamps
    updatedAt: bet.updatedAt!,
    signature: bet.signature,
  };
}
