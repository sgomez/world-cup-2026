import { randomUUID } from "node:crypto";
import { err, ok, type Result } from "neverthrow";
import { computeSignatureFromContent } from "@/lib/bet-signature";
import { getGroups } from "@/lib/teams";
import { createInitialState } from "@/modules/bracket";
import {
  extractScoreableContent,
  type ScoreableContent,
  type ScoreableContentArrays,
  toScoreableContent,
} from "@/modules/score";
import { BetLabel } from "./bet-label";
import type { BettingWindow } from "./betting-window";
import { type DomainError, domainError } from "./errors";

export type BetStatus = "draft" | "closed";
export type PeerVisibility = "full" | "summary" | "hidden";

/** ADR 0006: the two inputs that drive the entire R32 bracket. */
export type GroupPredictions = {
  groupOrders: Record<string, string[]>;
  thirdPlaceOrder: string[];
};

/** ADR 0006: sparse `matchId -> winnerId` map. 32 entries = a complete bet. */
export type KnockoutWinners = Record<string, string>;

/**
 * The full persistent state of a Bet. This is the shape the repository maps to
 * and from storage; the aggregate owns the invariants over it.
 */
export type BetState = {
  id: string;
  userId: string;
  status: BetStatus;
  label: string;
  groupPredictions: GroupPredictions | null;
  knockoutWinners: KnockoutWinners;
  directPredictions?: ScoreableContentArrays | null;
  createdAt?: Date;
  updatedAt?: Date;
};

const REQUIRED_KNOCKOUT_WINNERS = 32;

/**
 * The Bet aggregate root (identity = `id`). All single-Bet write invariants live
 * here (ADR 0008): status transitions, completeness of the 32 knockout winners,
 * and the injected Betting Window. The aggregate references its owner by
 * `userId` only and never knows the current user beyond the pure `isOwnedBy`
 * query — authorization is an application concern.
 *
 * Mutating methods are pure: they return a new aggregate inside a `Result`
 * rather than mutating in place, so predictions and the derived Bet Signature
 * (ADR 0007) are preserved untouched.
 */
export class Bet {
  private constructor(private readonly state: BetState) {}

  static fromState(state: BetState): Bet {
    if (state.groupPredictions && state.directPredictions) {
      throw new Error(
        "XOR invariant violated: Bet cannot have both groupPredictions and directPredictions",
      );
    }
    return new Bet({
      ...state,
      groupPredictions: state.groupPredictions ?? null,
      knockoutWinners: state.knockoutWinners ?? {},
      directPredictions: state.directPredictions ?? null,
    });
  }

  static create(
    label: string,
    ownerId: string,
    window: BettingWindow,
    now: Date,
  ): Result<Bet, DomainError> {
    if (!window.isOpen(now)) {
      return err(domainError("PAST_DEADLINE"));
    }
    return BetLabel.create(label).map((betLabel) =>
      Bet.fromState({
        id: randomUUID(),
        userId: ownerId,
        status: "draft",
        label: betLabel.value,
        groupPredictions: null,
        knockoutWinners: {},
        directPredictions: null,
      }),
    );
  }

  static copyFrom(
    source: Bet,
    ownerId: string,
    window: BettingWindow,
    now: Date,
  ): Result<Bet, DomainError> {
    if (!window.isOpen(now)) {
      return err(domainError("PAST_DEADLINE"));
    }
    const copyLabel = `Copy of ${source.label}`.slice(0, 200);
    return BetLabel.create(copyLabel).map((betLabel) =>
      Bet.fromState({
        id: randomUUID(),
        userId: ownerId,
        status: "draft",
        label: betLabel.value,
        groupPredictions: source.groupPredictions,
        knockoutWinners: source.knockoutWinners,
        directPredictions: source.directPredictions,
      }),
    );
  }

  static createDirect(
    label: string,
    ownerId: string,
    directPredictions: ScoreableContentArrays,
  ): Result<Bet, DomainError> {
    if (
      !directPredictions ||
      !Array.isArray(directPredictions.R32) ||
      !Array.isArray(directPredictions.R16) ||
      !Array.isArray(directPredictions.QF) ||
      !Array.isArray(directPredictions.SF) ||
      !Array.isArray(directPredictions.F)
    ) {
      return err(domainError("INVALID_PREDICTIONS"));
    }

    const checkStringArray = (arr: unknown[]) =>
      arr.every((item) => typeof item === "string");

    if (
      !checkStringArray(directPredictions.R32) ||
      !checkStringArray(directPredictions.R16) ||
      !checkStringArray(directPredictions.QF) ||
      !checkStringArray(directPredictions.SF) ||
      !checkStringArray(directPredictions.F) ||
      (directPredictions.champion !== null &&
        directPredictions.champion !== undefined &&
        typeof directPredictions.champion !== "string") ||
      (directPredictions.thirdPlace !== null &&
        directPredictions.thirdPlace !== undefined &&
        typeof directPredictions.thirdPlace !== "string")
    ) {
      return err(domainError("INVALID_PREDICTIONS"));
    }

    const normalizedPredictions: ScoreableContentArrays = {
      R32: Array.from(
        new Set(directPredictions.R32.map((id) => id.toLowerCase())),
      ),
      R16: Array.from(
        new Set(directPredictions.R16.map((id) => id.toLowerCase())),
      ),
      QF: Array.from(
        new Set(directPredictions.QF.map((id) => id.toLowerCase())),
      ),
      SF: Array.from(
        new Set(directPredictions.SF.map((id) => id.toLowerCase())),
      ),
      F: Array.from(new Set(directPredictions.F.map((id) => id.toLowerCase()))),
      champion: directPredictions.champion
        ? directPredictions.champion.toLowerCase()
        : null,
      thirdPlace: directPredictions.thirdPlace
        ? directPredictions.thirdPlace.toLowerCase()
        : null,
    };

    const KNOWN_TEAM_IDS = new Set(
      getGroups("en").flatMap((g) => g.teams.map((t) => t.id)),
    );

    // Validate round max sizes: R32 <= 32, R16 <= 16, QF <= 8, SF <= 4, F <= 2
    if (
      normalizedPredictions.R32.length > 32 ||
      normalizedPredictions.R16.length > 16 ||
      normalizedPredictions.QF.length > 8 ||
      normalizedPredictions.SF.length > 4 ||
      normalizedPredictions.F.length > 2
    ) {
      return err(domainError("INVALID_PREDICTIONS"));
    }

    // Validate all teams are known
    const allTeams = [
      ...normalizedPredictions.R32,
      ...normalizedPredictions.R16,
      ...normalizedPredictions.QF,
      ...normalizedPredictions.SF,
      ...normalizedPredictions.F,
    ];
    if (normalizedPredictions.champion) {
      allTeams.push(normalizedPredictions.champion);
    }
    if (normalizedPredictions.thirdPlace) {
      allTeams.push(normalizedPredictions.thirdPlace);
    }

    const allKnown = allTeams.every((id) => KNOWN_TEAM_IDS.has(id));
    if (!allKnown) {
      return err(domainError("INVALID_PREDICTIONS"));
    }

    return BetLabel.create(label).map((betLabel) =>
      Bet.fromState({
        id: randomUUID(),
        userId: ownerId,
        status: "closed",
        label: betLabel.value,
        groupPredictions: null,
        knockoutWinners: {},
        directPredictions: normalizedPredictions,
      }),
    );
  }

  get id(): string {
    return this.state.id;
  }

  get userId(): string {
    return this.state.userId;
  }

  get status(): BetStatus {
    return this.state.status;
  }

  get label(): string {
    return this.state.label;
  }

  get groupPredictions(): GroupPredictions | null {
    return this.state.groupPredictions;
  }

  get knockoutWinners(): KnockoutWinners {
    return this.state.knockoutWinners;
  }

  get directPredictions(): ScoreableContentArrays | null {
    return this.state.directPredictions ?? null;
  }

  get createdAt(): Date | undefined {
    return this.state.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.state.updatedAt;
  }

  get signature(): string | undefined {
    if (this.state.status !== "closed") return undefined;
    return computeSignatureFromContent(this.scoreableContent());
  }

  scoreableContent(): ScoreableContent {
    if (this.state.directPredictions) {
      return toScoreableContent(this.state.directPredictions);
    }
    const { knockoutMatches } = createInitialState(
      this.state.groupPredictions,
      this.state.knockoutWinners,
    );
    return extractScoreableContent(knockoutMatches);
  }

  isOwnedBy(userId: string): boolean {
    return this.state.userId === userId;
  }

  close(window: BettingWindow, now: Date): Result<Bet, DomainError> {
    if (this.state.directPredictions) {
      return err(domainError("BET_CLOSED"));
    }
    if (!window.isOpen(now)) {
      return err(domainError("PAST_DEADLINE"));
    }
    if (
      Object.keys(this.state.knockoutWinners).length < REQUIRED_KNOCKOUT_WINNERS
    ) {
      return err(domainError("INCOMPLETE_PREDICTIONS"));
    }
    return ok(new Bet({ ...this.state, status: "closed" }));
  }

  /**
   * Reopens a Bet to `draft` so its owner can keep editing. Guarded only by the
   * Betting Window: once the Bet Deadline has passed no Bet may change status.
   */
  reopen(window: BettingWindow, now: Date): Result<Bet, DomainError> {
    if (this.state.directPredictions) {
      return err(domainError("BET_CLOSED"));
    }
    if (!window.isOpen(now)) {
      return err(domainError("PAST_DEADLINE"));
    }
    return ok(new Bet({ ...this.state, status: "draft" }));
  }

  updatePredictions(
    groupPredictions: GroupPredictions | null,
    knockoutWinners: KnockoutWinners,
    window: BettingWindow,
    now: Date,
  ): Result<Bet, DomainError> {
    if (this.state.directPredictions) {
      return err(domainError("BET_CLOSED"));
    }
    if (!window.isOpen(now)) {
      return err(domainError("PAST_DEADLINE"));
    }
    if (this.state.status === "closed") {
      return err(domainError("BET_CLOSED"));
    }
    return ok(new Bet({ ...this.state, groupPredictions, knockoutWinners }));
  }

  rename(
    rawLabel: string,
    window: BettingWindow,
    now: Date,
  ): Result<Bet, DomainError> {
    if (this.state.directPredictions) {
      return err(domainError("BET_CLOSED"));
    }
    if (!window.isOpen(now)) {
      return err(domainError("PAST_DEADLINE"));
    }
    if (this.state.status !== "draft") {
      return err(domainError("BET_CLOSED"));
    }
    return BetLabel.create(rawLabel).map(
      (label) => new Bet({ ...this.state, label: label.value }),
    );
  }

  peerVisibility(window: BettingWindow, now: Date): PeerVisibility {
    if (this.state.status === "draft") {
      return "hidden";
    }
    if (window.isClosed(now)) {
      return "full";
    }
    if (this.state.status === "closed") {
      return "summary";
    }
    return "hidden";
  }

  toState(): BetState {
    return { ...this.state };
  }
}
