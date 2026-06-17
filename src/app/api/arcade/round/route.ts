import { NextResponse } from "next/server";
import { container } from "@/lib/container";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    runId,
    roundStartedAt: roundStartedAtRaw,
    reportedScore,
  } = body as Record<string, unknown>;

  if (
    !runId ||
    typeof runId !== "string" ||
    !roundStartedAtRaw ||
    typeof roundStartedAtRaw !== "string" ||
    reportedScore === undefined ||
    typeof reportedScore !== "number"
  ) {
    return NextResponse.json(
      { error: "runId, roundStartedAt, and reportedScore are required" },
      { status: 400 },
    );
  }

  const roundStartedAt = new Date(roundStartedAtRaw);
  if (Number.isNaN(roundStartedAt.getTime())) {
    return NextResponse.json(
      { error: "roundStartedAt must be a valid ISO date" },
      { status: 400 },
    );
  }

  const result = await container.arcade().recordRound({
    runId,
    userId: session.user.id,
    roundStartedAt,
    reportedScore,
  });

  if (result.isErr()) {
    const { code } = result.error;
    if (code === "RUN_NOT_FOUND") {
      return NextResponse.json({ error: code }, { status: 404 });
    }
    if (code === "RUN_NOT_IN_PROGRESS") {
      return NextResponse.json({ error: code }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const { run } = result.value;
  return NextResponse.json(
    {
      id: run.id,
      userId: run.userId,
      playDay: run.playDay,
      status: run.status,
      bestScore: run.bestScore,
      roundsPlayed: run.rounds.length,
    },
    { status: 200 },
  );
}
