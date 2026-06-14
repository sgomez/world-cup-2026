import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { container } from "@/lib/container";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ num: string }>;
};

const ScorePatchSchema = z.object({
  status: z.enum(["upcoming", "live", "finished"]),
  goals1: z.number(),
  goals2: z.number(),
  penalties1: z.number().optional(),
  penalties2: z.number().optional(),
});

const LinkPatchSchema = z.object({
  link: z.url(),
});

type ScorePatch = z.infer<typeof ScorePatchSchema>;
type LinkPatch = z.infer<typeof LinkPatchSchema>;

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

  // Constant-time comparison to prevent timing attacks
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

  return null; // authenticated
}

function mapErrorToResponse(code: string): Response {
  switch (code) {
    case "INVALID_NUM":
    case "NOT_FOUND":
      return NextResponse.json({ error: code }, { status: 404 });
    case "INVALID_GOALS":
    case "PENALTIES_NOT_ALLOWED":
      return NextResponse.json({ error: code }, { status: 422 });
    case "SAVE_FAILED":
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    default:
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function parseBody(
  request: Request,
): Promise<ScorePatch | LinkPatch | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    body !== null &&
    typeof body === "object" &&
    "link" in body &&
    !("status" in body)
  ) {
    const result = LinkPatchSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 422 });
    }
    return result.data;
  }

  const result = ScorePatchSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 422 });
  }
  return result.data;
}

function isLinkPatch(body: ScorePatch | LinkPatch): body is LinkPatch {
  return "link" in body;
}

export async function PUT(request: Request, context: RouteContext) {
  const authError = authenticate(request);
  if (authError) return authError;

  const { num: numStr } = await context.params;
  const num = Number(numStr);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ScorePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 422 });
  }

  const result = await container.live().upsert({
    num,
    status: parsed.data.status,
    goals1: parsed.data.goals1,
    goals2: parsed.data.goals2,
    ...(parsed.data.penalties1 !== undefined
      ? { penalties1: parsed.data.penalties1 }
      : {}),
    ...(parsed.data.penalties2 !== undefined
      ? { penalties2: parsed.data.penalties2 }
      : {}),
    allowCreate: true,
  });

  if (result.isErr()) {
    return mapErrorToResponse(result.error.code);
  }

  const { liveResult, events } = result._unsafeUnwrap();
  return NextResponse.json({
    num: liveResult.num,
    status: liveResult.status,
    goals1: liveResult.goals1,
    goals2: liveResult.goals2,
    penalties1: liveResult.penalties1,
    penalties2: liveResult.penalties2,
    events: events.map((e) => e.type),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authError = authenticate(request);
  if (authError) return authError;

  const { num: numStr } = await context.params;
  const num = Number(numStr);

  const body = await parseBody(request);
  if (body instanceof Response) return body;

  if (isLinkPatch(body)) {
    const result = await container.live().setLink({ num, link: body.link });
    if (result.isErr()) {
      return mapErrorToResponse(result.error.code);
    }
    return NextResponse.json({ num });
  }

  const result = await container.live().upsert({
    num,
    status: body.status,
    goals1: body.goals1,
    goals2: body.goals2,
    ...(body.penalties1 !== undefined ? { penalties1: body.penalties1 } : {}),
    ...(body.penalties2 !== undefined ? { penalties2: body.penalties2 } : {}),
    allowCreate: false,
  });

  if (result.isErr()) {
    return mapErrorToResponse(result.error.code);
  }

  const { liveResult, events } = result._unsafeUnwrap();
  return NextResponse.json({
    num: liveResult.num,
    status: liveResult.status,
    goals1: liveResult.goals1,
    goals2: liveResult.goals2,
    penalties1: liveResult.penalties1,
    penalties2: liveResult.penalties2,
    events: events.map((e) => e.type),
  });
}
