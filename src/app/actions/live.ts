"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { container } from "@/lib/container";
import type { LiveStatus } from "@/modules/live/domain/live-result";
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
