import {
  extractScoreableContent,
  type ScoreableContentArrays,
  toScoreableContentArrays,
} from "@/lib/scoring";
import { Tournament } from "../domain/tournament";
import type { TournamentRepository } from "../domain/tournament-repository";

export async function getActualScoreableContent(
  repo: TournamentRepository,
): Promise<ScoreableContentArrays> {
  const tournament = await repo.get();
  const activeTournament = tournament ?? Tournament.createDefault();
  const bracketView = activeTournament.bracketView();
  const scoreableContent = extractScoreableContent(bracketView);
  return toScoreableContentArrays(scoreableContent);
}
