import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import type { Match } from "@/modules/schedule";
import type { LiveFeed, LiveFeedSnapshot } from "../domain/live-feed";
import type { LiveResult } from "../domain/live-result";
import type { MatchContextResolver } from "./match-context-resolver";

// ---------------------------------------------------------------------------
// Boundary zod schema (strict mode: every key required and nullable, never optional)
// ---------------------------------------------------------------------------

const liveFeedResponseSchema = z.object({
  dataFound: z.boolean(),
  homeTeam: z.string(),
  awayTeam: z.string(),
  phase: z.enum([
    "not_started",
    "first_half",
    "second_half",
    "extra_time",
    "penalties",
    "finished",
  ]),
  minute: z.number().int().min(0).max(130).nullable(),
  inStoppage: z.boolean(),
  homeGoals: z.number().int().min(0),
  awayGoals: z.number().int().min(0),
  homePenalties: z.number().int().min(0).nullable(),
  awayPenalties: z.number().int().min(0).nullable(),
  sourceUrl: z.string().nullable(),
});

type LiveFeedResponse = z.infer<typeof liveFeedResponseSchema>;

// ---------------------------------------------------------------------------
// Injected responder interface (for deterministic offline tests)
// ---------------------------------------------------------------------------

export type StructuredResponderPrompt = {
  system: string;
  user: string;
};

/**
 * Thin interface around the OpenAI call so tests can inject a fake.
 * The production impl issues a single Responses API call with web_search + json_schema.
 */
export type StructuredResponder = (
  prompt: StructuredResponderPrompt,
) => Promise<unknown>;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You extract live match data for the FIFA World Cup 2026 using web search.
Find the CURRENT state of the ONE match described and return only the structured fields.
- Use the most recent, authoritative source (official FIFA or a major live-score site).
- If you cannot find reliable current data for THIS exact match, set dataFound=false and
  leave all scores 0. Never invent a score.
- Report goals/penalties in the given home/away order.
- phase: not_started before kickoff; first_half; second_half; extra_time; penalties; finished at full time.
- minute: current on-pitch minute; null during penalties or before kickoff. inStoppage=true only in added time.
- homePenalties/awayPenalties: only for a knockout shootout; otherwise null.
- homeTeam/awayTeam: the team names you determined for each side.`;

function buildUserPrompt(
  home: string,
  away: string,
  round: string,
  date: string,
  ground: string,
): string {
  const nowIso = new Date().toISOString();
  return `Match: ${home} vs ${away}
Competition: FIFA World Cup 2026 — ${round}
Date/venue: ${date} at ${ground}
home=${home}, away=${away}
Current time (UTC): ${nowIso}`;
}

// ---------------------------------------------------------------------------
// Guard: normalize a team name for comparison
// ---------------------------------------------------------------------------

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Production StructuredResponder (OpenAI SDK)
// ---------------------------------------------------------------------------

/**
 * Creates a production responder using the OpenAI SDK.
 * Issues a single Responses API call with the hosted web_search tool
 * and strict json_schema output.
 */
export function createOpenAiResponder(
  apiKey: string,
  model: string,
): StructuredResponder {
  return async (prompt: StructuredResponderPrompt) => {
    const { default: OpenAI } = await import("openai");
    type Responses = InstanceType<typeof OpenAI>["responses"];
    type CreateParams = Parameters<Responses["create"]>[0];
    const client = new OpenAI({ apiKey });

    // Cast to non-streaming params so TypeScript selects the non-streaming overload
    // and the return type is Response (which has output_text).
    const params: CreateParams = {
      model,
      stream: false,
      tools: [{ type: "web_search_preview" }],
      text: {
        format: {
          type: "json_schema",
          name: "live_feed_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              dataFound: { type: "boolean" },
              homeTeam: { type: "string" },
              awayTeam: { type: "string" },
              phase: {
                type: "string",
                enum: [
                  "not_started",
                  "first_half",
                  "second_half",
                  "extra_time",
                  "penalties",
                  "finished",
                ],
              },
              minute: { type: ["integer", "null"], minimum: 0, maximum: 130 },
              inStoppage: { type: "boolean" },
              homeGoals: { type: "integer", minimum: 0 },
              awayGoals: { type: "integer", minimum: 0 },
              homePenalties: { type: ["integer", "null"], minimum: 0 },
              awayPenalties: { type: ["integer", "null"], minimum: 0 },
              sourceUrl: { type: ["string", "null"] },
            },
            required: [
              "dataFound",
              "homeTeam",
              "awayTeam",
              "phase",
              "minute",
              "inStoppage",
              "homeGoals",
              "awayGoals",
              "homePenalties",
              "awayPenalties",
              "sourceUrl",
            ],
            additionalProperties: false,
          },
        },
      },
      input: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    };

    const response = await client.responses.create(params);
    const outputText = (response as { output_text?: string }).output_text;
    if (!outputText) {
      throw new Error("OpenAI response had no output_text");
    }
    return JSON.parse(outputText);
  };
}

// ---------------------------------------------------------------------------
// OpenAiLiveFeed adapter
// ---------------------------------------------------------------------------

function isKnockout(num: number): boolean {
  return num >= 73;
}

export class OpenAiLiveFeed implements LiveFeed {
  constructor(
    /** Model name (stored for introspection/testing; the responder already encapsulates it). */
    readonly _model: string,
    private readonly resolver: MatchContextResolver,
    private readonly responder: StructuredResponder,
  ) {}

  async fetchSnapshot(
    match: Match,
    current: LiveResult | null,
  ): Promise<Result<LiveFeedSnapshot, Error>> {
    const knockout = isKnockout(match.num);

    // Resolve team names
    let home: string;
    let away: string;

    if (knockout) {
      const participants = this.resolver.resolveParticipants(match.num);
      if (!participants) {
        return err(
          new Error(
            `Resolver returned null for knockout match ${match.num} — participants not yet derivable`,
          ),
        );
      }
      home = participants.home;
      away = participants.away;
    } else {
      // Group stage: real names are directly in worldcup.json
      home = match.team1;
      away = match.team2;
    }

    // Call the responder
    let raw: unknown;
    try {
      raw = await this.responder({
        system: SYSTEM_PROMPT,
        user: buildUserPrompt(
          home,
          away,
          match.round,
          match.date,
          match.ground,
        ),
      });
    } catch (e) {
      return err(
        e instanceof Error
          ? e
          : new Error(`OpenAI responder failed for match ${match.num}: ${e}`),
      );
    }

    // Validate at the boundary
    const parsed = liveFeedResponseSchema.safeParse(raw);
    if (!parsed.success) {
      return err(
        new Error(
          `Schema validation failed for match ${match.num}: ${parsed.error.message}`,
        ),
      );
    }

    const data: LiveFeedResponse = parsed.data;

    // dataFound=false → skip (preserve stored)
    if (!data.dataFound) {
      return err(
        new Error(
          `dataFound=false for match ${match.num} — no reliable web data found`,
        ),
      );
    }

    // Group guard: validate team names match fixture
    if (!knockout) {
      const modelHome = normalize(data.homeTeam);
      const modelAway = normalize(data.awayTeam);
      const fixtureHome = normalize(home);
      const fixtureAway = normalize(away);

      if (modelHome !== fixtureHome || modelAway !== fixtureAway) {
        return err(
          new Error(
            `Team mismatch for group match ${match.num}: model returned "${data.homeTeam}" vs "${data.awayTeam}", fixture expects "${home}" vs "${away}"`,
          ),
        );
      }
    }

    // Build snapshot
    const finished = data.phase === "finished";

    // Penalties: write-when-present, echo-when-absent; strip for group stage
    let penalties1: number | undefined;
    let penalties2: number | undefined;

    if (!knockout) {
      // Group stage: always strip
      penalties1 = undefined;
      penalties2 = undefined;
    } else if (data.homePenalties !== null && data.awayPenalties !== null) {
      // Knockout + both present: write
      penalties1 = data.homePenalties;
      penalties2 = data.awayPenalties;
    } else {
      // Knockout + absent: echo stored (if any)
      const stored1 = current?.penalties1;
      const stored2 = current?.penalties2;
      if (stored1 !== undefined && stored2 !== undefined) {
        penalties1 = stored1;
        penalties2 = stored2;
      }
      // Otherwise leave undefined
    }

    const snapshot: LiveFeedSnapshot = {
      goals1: data.homeGoals,
      goals2: data.awayGoals,
      finished,
      phase: data.phase,
      minute: data.minute,
      inStoppage: data.inStoppage,
      ...(penalties1 !== undefined ? { penalties1 } : {}),
      ...(penalties2 !== undefined ? { penalties2 } : {}),
    };

    return ok(snapshot);
  }
}
