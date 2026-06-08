import type { ResultAsync } from "neverthrow";
import type { DomainError } from "./errors";
import type { Tournament } from "./tournament";

export interface TournamentRepository {
  get(): Promise<Tournament | null>;
  save(tournament: Tournament): ResultAsync<void, DomainError>;
}
