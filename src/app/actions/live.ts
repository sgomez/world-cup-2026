"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { container } from "@/lib/container";
import { SystemClock } from "@/modules/live/domain/clock";
import type { LiveStatus } from "@/modules/live/domain/live-result";
import {
  createLiveFeed,
  readLiveFeedConfig,
} from "@/modules/live/infrastructure/live-feed-factory";
import { getMatchByNum } from "@/modules/schedule";
import { withAuthenticatedAction } from "./authenticated-action";

export type UpsertLiveResultInput = {
  num: number;
  status: LiveStatus;
  goals1: number;
  goals2: number;
  penalties1?: number;
  penalties2?: number;
  allowCreate: boolean;
  adminOverride?: boolean;
};

export type LiveActionState = {
  error?: string;
  success?: boolean;
} | null;

async function liveErrorMessage(code: string): Promise<string> {
  const t = await getTranslations("liveErrors");
  return t(code as never);
}

/**
 * Admin server action to create or update a LiveResult.
 *
 * Uses the same reconcile-to-target command as the bot API (ADR 0015).
 * Only `admin` and `super_admin` roles are permitted; non-admin callers
 * receive a FORBIDDEN error.
 */
export async function upsertLiveResultAction(
  input: UpsertLiveResultInput,
): Promise<LiveActionState> {
  return withAuthenticatedAction(async (session) => {
    const role = session.user.role;
    if (role !== "admin" && role !== "super_admin") {
      return {
        error: await liveErrorMessage("FORBIDDEN"),
      };
    }

    const result = await container.live().upsert({
      num: input.num,
      status: input.status,
      goals1: input.goals1,
      goals2: input.goals2,
      ...(input.penalties1 !== undefined
        ? { penalties1: input.penalties1 }
        : {}),
      ...(input.penalties2 !== undefined
        ? { penalties2: input.penalties2 }
        : {}),
      allowCreate: input.allowCreate,
      adminOverride: input.adminOverride,
    });

    if (result.isErr()) {
      return { error: await liveErrorMessage(result.error.code) };
    }

    revalidatePath("/admin/result");
    revalidatePath("/standings");
    revalidatePath("/calendar");
    return { success: true };
  });
}

/**
 * Admin server action to force-refresh a single match by scraping its linked
 * feed source, bypassing the "finished" latch so completed matches can also
 * be re-scraped on demand.
 */
export async function forceRefreshMatchAction(
  num: number,
): Promise<LiveActionState> {
  return withAuthenticatedAction(async (session) => {
    const role = session.user.role;
    if (role !== "admin" && role !== "super_admin") {
      return {
        error: await liveErrorMessage("FORBIDDEN"),
      };
    }

    const match = getMatchByNum(num);
    if (!match) {
      return { error: await liveErrorMessage("NOT_FOUND") };
    }

    const current = await container.live().findByNum(num);

    const config = readLiveFeedConfig();
    const clock = new SystemClock();
    const feed = createLiveFeed(config, clock);

    const snapshotResult = await feed.fetchSnapshot(match, current);
    if (snapshotResult.isErr()) {
      return { error: snapshotResult.error.message };
    }

    const snapshot = snapshotResult.value;

    const result = await container.live().upsert({
      num,
      status: snapshot.finished ? "finished" : "live",
      goals1: snapshot.goals1,
      goals2: snapshot.goals2,
      ...(snapshot.penalties1 !== undefined
        ? { penalties1: snapshot.penalties1 }
        : {}),
      ...(snapshot.penalties2 !== undefined
        ? { penalties2: snapshot.penalties2 }
        : {}),
      allowCreate: true,
      adminOverride: true,
    });

    if (result.isErr()) {
      return { error: await liveErrorMessage(result.error.code) };
    }

    revalidatePath("/admin/result");
    revalidatePath("/standings");
    revalidatePath("/calendar");
    return { success: true };
  });
}
