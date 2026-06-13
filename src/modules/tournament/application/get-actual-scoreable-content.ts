import type { LiveResult } from "@/modules/live/domain/live-result";
import {
  extractScoreableContent,
  type ScoreableContentArrays,
  toScoreableContentArrays,
} from "@/modules/score";
import { Tournament } from "../domain/tournament";

export function getActualScoreableContent(
  tournament: Tournament | null,
  liveResults: LiveResult[],
): ScoreableContentArrays {
  const activeTournament = tournament ?? Tournament.createDefault();
  const bracketView = activeTournament.bracketView(liveResults, {
    provisional: true,
  });
  const scoreableContent = extractScoreableContent(bracketView);
  return toScoreableContentArrays(scoreableContent);
}
