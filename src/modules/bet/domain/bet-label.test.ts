import { describe, expect, it } from "vitest";
import { BetLabel, obfuscateLabel, serializeLabel } from "./bet-label";

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

describe("bet label obfuscation", () => {
  it("leaves native/owner labels unobfuscated", () => {
    const label = "123 | David";
    expect(serializeLabel(label, false, false)).toEqual({
      obfuscated: false,
      value: label,
    });
    expect(serializeLabel(label, true, true)).toEqual({
      obfuscated: false,
      value: label,
    });
  });

  it("obfuscates imported non-owner labels", () => {
    const label = "123 | David";
    expect(serializeLabel(label, true, false)).toEqual({
      obfuscated: true,
      num: "123",
      head: "Da",
      tail: "id",
      middleLen: 1,
    });
  });

  it("handles names with <= 4 alphabetical characters by hiding the name entirely", () => {
    expect(obfuscateLabel("123 | Leo")).toEqual({
      obfuscated: true,
      num: "123",
      head: "",
      tail: "",
      middleLen: 3,
    });

    expect(obfuscateLabel("123 | Ana")).toEqual({
      obfuscated: true,
      num: "123",
      head: "",
      tail: "",
      middleLen: 3,
    });

    expect(obfuscateLabel("123 | Abcd")).toEqual({
      obfuscated: true,
      num: "123",
      head: "",
      tail: "",
      middleLen: 4,
    });
  });

  it("handles names with > 4 alphabetical characters", () => {
    expect(obfuscateLabel("123 | David")).toEqual({
      obfuscated: true,
      num: "123",
      head: "Da",
      tail: "id",
      middleLen: 1,
    });

    expect(obfuscateLabel("123 | Sergio")).toEqual({
      obfuscated: true,
      num: "123",
      head: "Se",
      tail: "io",
      middleLen: 2,
    });
  });

  it("handles names with punctuation/quotes/spaces correctly", () => {
    // David P (6 alphabetical chars: D, a, v, i, d, P. Total chars: 7)
    expect(obfuscateLabel("123 | David P")).toEqual({
      obfuscated: true,
      num: "123",
      head: "Da",
      tail: "dP",
      middleLen: 3,
    });

    // David "Gordito" (12 alphabetical chars: D, a, v, i, d, G, o, r, d, i, t, o. Total chars: 15)
    expect(obfuscateLabel('123 | David "Gordito"')).toEqual({
      obfuscated: true,
      num: "123",
      head: "Da",
      tail: "to",
      middleLen: 11,
    });
  });

  it("handles international alphabetical characters (unicode)", () => {
    // María (5 alphabetical chars: M, a, r, í, a. Total chars: 5)
    expect(obfuscateLabel("456 | María")).toEqual({
      obfuscated: true,
      num: "456",
      head: "Ma",
      tail: "ía",
      middleLen: 1,
    });

    // Núñez (5 alphabetical chars: N, ú, ñ, e, z. Total chars: 5)
    expect(obfuscateLabel("789 | Núñez")).toEqual({
      obfuscated: true,
      num: "789",
      head: "Nú",
      tail: "ez",
      middleLen: 1,
    });
  });

  it("handles labels without a separator gracefully", () => {
    expect(obfuscateLabel("David")).toEqual({
      obfuscated: true,
      num: "",
      head: "Da",
      tail: "id",
      middleLen: 1,
    });
  });
});
