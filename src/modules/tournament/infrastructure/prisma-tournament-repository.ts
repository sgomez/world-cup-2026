import type { PrismaClient } from "@prisma/client";
import { ResultAsync } from "neverthrow";
import { type DomainError, domainError } from "../domain/errors";
import { Tournament } from "../domain/tournament";
import type { TournamentRepository } from "../domain/tournament-repository";

type TournamentClient = Pick<PrismaClient, "tournament">;

export class PrismaTournamentRepository implements TournamentRepository {
  constructor(private readonly client: TournamentClient) {}

  async get(): Promise<Tournament | null> {
    const row = await this.client.tournament.findUnique({
      where: { id: "singleton" },
    });
    if (!row) return null;

    return Tournament.fromState({
      id: row.id,
      manualTieBreaks: (row.manualTieBreaks as Record<string, string[]>) ?? {},
      thirdPlaceManualOrder:
        (row.thirdPlaceManualOrder as string[] | null) ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  save(tournament: Tournament): ResultAsync<void, DomainError> {
    const state = tournament.toState();
    return ResultAsync.fromPromise(
      this.client.tournament
        .upsert({
          where: { id: state.id },
          create: {
            id: state.id,
            manualTieBreaks: state.manualTieBreaks as any,
            thirdPlaceManualOrder:
              (state.thirdPlaceManualOrder as any) ?? undefined,
          },
          update: {
            manualTieBreaks: state.manualTieBreaks as any,
            thirdPlaceManualOrder: (state.thirdPlaceManualOrder as any) ?? null,
          },
        })
        .then(() => {}),
      (error) => {
        console.error("Failed to save tournament:", error);
        return domainError("SAVE_FAILED");
      },
    );
  }
}
