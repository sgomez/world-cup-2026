import type { PrismaClient } from "@prisma/client";
import { ResultAsync } from "neverthrow";
import { type LiveDomainError, liveDomainError } from "../domain/errors";
import { LiveResult, type LiveStatus } from "../domain/live-result";
import type { LiveResultRepository } from "../domain/live-result-repository";

type LiveResultClient = Pick<PrismaClient, "liveResult">;

export class PrismaLiveResultRepository implements LiveResultRepository {
  constructor(private readonly client: LiveResultClient) {}

  async findByNum(num: number): Promise<LiveResult | null> {
    const row = await this.client.liveResult.findUnique({
      where: { num },
    });
    if (!row) return null;

    return LiveResult.fromState({
      num: row.num,
      status: row.status as LiveStatus,
      goals1: row.goals1,
      goals2: row.goals2,
      penalties1: row.penalties1 ?? undefined,
      penalties2: row.penalties2 ?? undefined,
      link: row.link ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async findAll(): Promise<LiveResult[]> {
    const rows = await this.client.liveResult.findMany();
    return rows.map((row) =>
      LiveResult.fromState({
        num: row.num,
        status: row.status as LiveStatus,
        goals1: row.goals1,
        goals2: row.goals2,
        penalties1: row.penalties1 ?? undefined,
        penalties2: row.penalties2 ?? undefined,
        link: row.link ?? undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    );
  }

  save(liveResult: LiveResult): ResultAsync<void, LiveDomainError> {
    const state = liveResult.toState();
    return ResultAsync.fromPromise(
      this.client.liveResult
        .upsert({
          where: { num: state.num },
          create: {
            num: state.num,
            status: state.status,
            goals1: state.goals1,
            goals2: state.goals2,
            penalties1: state.penalties1 ?? null,
            penalties2: state.penalties2 ?? null,
            link: state.link ?? null,
          },
          update: {
            status: state.status,
            goals1: state.goals1,
            goals2: state.goals2,
            penalties1: state.penalties1 ?? null,
            penalties2: state.penalties2 ?? null,
          },
        })
        .then(() => {}),
      (error) => {
        console.error("Failed to save LiveResult:", error);
        return liveDomainError("SAVE_FAILED");
      },
    );
  }

  saveLink(num: number, link: string): ResultAsync<void, LiveDomainError> {
    return ResultAsync.fromPromise(
      this.client.liveResult
        .update({
          where: { num },
          data: { link },
        })
        .then(() => {}),
      (error) => {
        console.error("Failed to save link for LiveResult:", error);
        return liveDomainError("SAVE_FAILED");
      },
    );
  }
}
