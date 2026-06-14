import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { container } from "@/lib/container";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(["upcoming", "live", "finished"]);

const PostBodySchema = z.object({
  num: z.number().int().min(1).max(104),
  link: z.url().optional(),
});

function authenticate(request: Request): Response | null {
  const tokenEnv = process.env.LIVE_FEED_TOKEN;

  if (!tokenEnv) {
    return NextResponse.json(
      { error: "Live feed is not configured" },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("Authorization");
  const provided = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!provided) {
    return NextResponse.json(
      { error: "Authorization required" },
      { status: 401 },
    );
  }

  try {
    const expectedBuf = Buffer.from(tokenEnv, "utf8");
    const providedBuf = Buffer.from(provided, "utf8");
    if (
      expectedBuf.length !== providedBuf.length ||
      !timingSafeEqual(expectedBuf, providedBuf)
    ) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const requested = statusParam
    ? statusParam.split(",").filter((s) => VALID_STATUSES.has(s))
    : ["live"];

  const all = await container.live().findAll();
  const filtered = all.filter((lr) => requested.includes(lr.status));

  return NextResponse.json(
    filtered.map((lr) => ({
      num: lr.num,
      status: lr.status,
      goals1: lr.goals1,
      goals2: lr.goals2,
      penalties1: lr.penalties1,
      penalties2: lr.penalties2,
    })),
  );
}

export async function POST(request: Request) {
  const authError = authenticate(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 422 });
  }

  const result = await container.live().create(parsed.data);

  if (result.isErr()) {
    const { code } = result.error;
    if (code === "ALREADY_EXISTS") {
      return NextResponse.json({ error: code }, { status: 409 });
    }
    if (code === "INVALID_NUM") {
      return NextResponse.json({ error: code }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const { liveResult } = result._unsafeUnwrap();
  return NextResponse.json(
    {
      num: liveResult.num,
      status: liveResult.status,
      goals1: liveResult.goals1,
      goals2: liveResult.goals2,
    },
    { status: 201 },
  );
}
