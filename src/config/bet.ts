export const BET_DEADLINE = new Date(
  process.env.BET_DEADLINE || "2026-06-11T19:00:00Z",
);

export const MAX_BETS_PER_USER: number =
  Number.parseInt(process.env.MAX_BETS_PER_USER ?? "", 10) || 3;
