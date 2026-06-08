import { err, ok, type Result } from "neverthrow";
import { computeBetSignature } from "@/lib/bet-signature";
import { BetLabel } from "./bet-label";
import type { BettingWindow } from "./betting-window";
import { type DomainError, domainError } from "./errors";

export type BetStatus = "draft" | "closed";

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
    return new Bet({ ...state });
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

  get createdAt(): Date | undefined {
    return this.state.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.state.updatedAt;
  }

  get signature(): string | undefined {
    if (this.state.status !== "closed") return undefined;
    return computeBetSignature(
      this.state.groupPredictions,
      this.state.knockoutWinners,
    );
  }

  isOwnedBy(userId: string): boolean {
    return this.state.userId === userId;
  }

  close(window: BettingWindow, now: Date): Result<Bet, DomainError> {
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

  toState(): BetState {
    return { ...this.state };
  }
}
