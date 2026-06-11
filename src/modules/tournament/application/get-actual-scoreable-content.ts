import {
  extractScoreableContent,
  type ScoreableContentArrays,
  toScoreableContentArrays,
} from "@/lib/scoring";
import type { LiveResultRepository } from "@/modules/live/domain/live-result-repository";
import { Tournament } from "../domain/tournament";
import type { TournamentRepository } from "../domain/tournament-repository";

export async function getActualScoreableContent(
  tournamentRepo: TournamentRepository,
  liveResultRepo: LiveResultRepository,
): Promise<ScoreableContentArrays> {
  const [tournament, liveResults] = await Promise.all([
    tournamentRepo.get(),
    liveResultRepo.findAll(),
  ]);
  const activeTournament = tournament ?? Tournament.createDefault();
  const bracketView = activeTournament.bracketView(liveResults);
  const scoreableContent = extractScoreableContent(bracketView);
  return toScoreableContentArrays(scoreableContent);
}
