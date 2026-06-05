export const BET_DEADLINE = new Date("2026-06-11T19:00:00Z");

export const MAX_BETS_PER_USER: number = process.env.MAX_BETS_PER_USER
  ? Number.parseInt(process.env.MAX_BETS_PER_USER, 10)
  : 3;
