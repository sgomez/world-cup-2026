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

  const { runId } = body as Record<string, unknown>;
  if (!runId || typeof runId !== "string") {
    return NextResponse.json({ error: "runId is required" }, { status: 400 });
  }

  const result = await container.arcade().recordHeartbeat({
    runId,
    userId: session.user.id,
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

  return NextResponse.json({ ok: true }, { status: 200 });
}
