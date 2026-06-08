/**
 * Tournament-wide policy deciding whether Bet writes are open at a given `now`
 * (CONTEXT.md term "Betting Window", ADR 0008).
 *
 * Derived from the Bet Deadline and injected into every mutating aggregate
 * method — never read ambiently — so "no writes after the deadline" cannot be
 * forgotten by a caller. The deadline is read live on each check so a test that
 * mocks `Date.getTime()` is still respected.
 */
export class BettingWindow {
  constructor(private readonly deadline: Date) {}

  isOpen(now: Date): boolean {
    return now.getTime() <= this.deadline.getTime();
  }
}
