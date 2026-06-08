export const BET_DEADLINE = new Date("2026-06-11T19:00:00Z");

export const MAX_BETS_PER_USER: number =
  Number.parseInt(process.env.MAX_BETS_PER_USER ?? "", 10) || 3;

export const TOURNAMENT_ENDED = false;
