import { createHash } from "node:crypto";
import type { ScoreableContent } from "./index";

/**
 * Computes a SHA-256 fingerprint of a Bet's scoreable content.
 *
 * The canonical string is built from the seven scoreable-content components
 * in fixed order (ADR 0007), prefixed with the secret salt (ADR 0014):
 *   sha256(SALT + "R32:…|R16:…|QF:…|SF:…|F:…|C:…|3RD:…")
 *
 * Team IDs within each round set are sorted lexicographically so the result
 * is stable regardless of Set iteration order.
 *
 * This function lives in a server-only sub-path of the Score module because
 * `node:crypto` is not available in the browser bundle. The isomorphic
 * `index.ts` (score, scoreBreakdown, extractScoreableContent) remains
 * client-safe. Import via `@/modules/score/server` from server components,
 * API routes, and server actions only.
 */
export function signature(content: ScoreableContent): string {
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
