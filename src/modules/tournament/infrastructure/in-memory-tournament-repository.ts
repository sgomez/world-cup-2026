import { okAsync, type ResultAsync } from "neverthrow";
import type { DomainError } from "../domain/errors";
import type { Tournament } from "../domain/tournament";
import type { TournamentRepository } from "../domain/tournament-repository";

export class InMemoryTournamentRepository implements TournamentRepository {
  private tournament: Tournament | null = null;

  constructor(seed: Tournament | null = null) {
    this.tournament = seed;
  }

  async get(): Promise<Tournament | null> {
    return this.tournament;
  }

  save(tournament: Tournament): ResultAsync<void, DomainError> {
    this.tournament = tournament;
    return okAsync(undefined);
  }

  getData(): Tournament | null {
    return this.tournament;
  }

  setData(data: Tournament | null) {
    this.tournament = data;
  }
}
