import { createHash } from "node:crypto";
import { createInitialState, type PredictionState } from "./prediction-state";
import { extractScoreableContent } from "./scoring";

export function computeBetSignature(
  groupPredictions: PredictionState | null,
  knockoutWinners: Record<string, string> | null,
): string {
  const { knockoutMatches } = createInitialState(
    groupPredictions,
    knockoutWinners,
  );

  const content = extractScoreableContent(knockoutMatches);

  const parts: string[] = [];
  const rounds = ["R32", "R16", "QF", "SF", "F"] as const;
  for (const round of rounds) {
    const sortedTeams = [...content[round]].sort();
    parts.push(`${round}:${sortedTeams.join(",")}`);
  }

  parts.push(`C:${content.champion || ""}`);
  parts.push(`3RD:${content.thirdPlace || ""}`);

  const salt = process.env.BET_SIGNATURE_SALT || "";
  return createHash("sha256")
    .update(salt + parts.join("|"))
    .digest("hex");
}
