import { NextResponse } from "next/server";
import { container } from "@/lib/container";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(_request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await container.arcade().startRun({
    userId: session.user.id,
  });

  if (result.isErr()) {
    const { code } = result.error;
    if (code === "ALREADY_PLAYED_TODAY") {
      return NextResponse.json({ error: code }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const { run } = result._unsafeUnwrap();
  return NextResponse.json(
    {
      id: run.id,
      userId: run.userId,
      playDay: run.playDay,
      startedAt: run.startedAt,
      status: run.status,
      bestScore: run.bestScore,
    },
    { status: 201 },
  );
}
