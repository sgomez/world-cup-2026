import worldcupData from "@/../data/worldcup.json";

/**
 * A single match from the tournament schedule (`data/worldcup.json`).
 *
 * Every match carries a stable, unique `num` — its **Match Number** (see
 * CONTEXT.md): 1–72 for the group stage in official FIFA chronological order,
 * 73–102 for the existing knockout numbering, 103 for the third-place match and
 * 104 for the Final. It is the identifier a LiveResult is keyed by and the value
 * the live-update API addresses.
 */
export type Match = {
  round: string;
  num: number;
  date: string;
  time: string;
  team1: string;
  team2: string;
  group?: string;
  ground: string;
};

const allMatches = worldcupData.matches as Match[];

const matchesByNum = new Map<number, Match>(
  allMatches.map((match) => [match.num, match]),
);

/** Returns every match in the tournament. */
export function getAllMatches(): Match[] {
  return allMatches;
}

/** Looks a match up by its Match Number, or `undefined` if none exists. */
export function getMatchByNum(num: number): Match | undefined {
  return matchesByNum.get(num);
}
