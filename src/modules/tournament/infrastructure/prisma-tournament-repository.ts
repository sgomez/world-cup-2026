import type { PrismaClient } from "@prisma/client";
import { ResultAsync } from "neverthrow";
import { type DomainError, domainError } from "../domain/errors";
import { Tournament, type TournamentResult } from "../domain/tournament";
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
      result: row.result as TournamentResult | null,
      advancement: (row.advancement as string[] | null) ?? [],
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
            result: (state.result as any) ?? undefined,
            advancement: state.advancement,
          },
          update: {
            result: (state.result as any) ?? null,
            advancement: state.advancement,
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
