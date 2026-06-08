import { describe, expect, it } from "vitest";
import { BetLabel } from "./bet-label";

describe("BetLabel", () => {
  it("creates from a valid non-empty string", () => {
    const result = BetLabel.create("My Bet");
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().value).toBe("My Bet");
  });

  it("trims surrounding whitespace", () => {
    const result = BetLabel.create("  My Bet  ");
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().value).toBe("My Bet");
  });

  it("accepts exactly 200 characters", () => {
    const result = BetLabel.create("a".repeat(200));
    expect(result.isOk()).toBe(true);
  });

  it("rejects empty string with INVALID_LABEL", () => {
    const result = BetLabel.create("");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_LABEL");
  });

  it("rejects whitespace-only string with INVALID_LABEL", () => {
    const result = BetLabel.create("   ");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_LABEL");
  });

  it("rejects labels longer than 200 characters with INVALID_LABEL", () => {
    const result = BetLabel.create("a".repeat(201));
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_LABEL");
  });
});
