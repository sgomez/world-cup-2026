import { describe, expect, it, vi } from "vitest";
import { placeholderLabel } from "./placeholder-label";

describe("placeholderLabel", () => {
  const mockT = vi.fn((key, options) => {
    if (key === "winnerMatch") return `Winner of Match ${options.num}`;
    if (key === "loserMatch") return `Loser of Match ${options.num}`;
    if (key === "winnerGroup") return `Winner of Group ${options.group}`;
    if (key === "runnerUpGroup") return `Runner-up of Group ${options.group}`;
    if (key === "bestThird") return `Best 3rd of ${options.groups}`;
    return key;
  });

  it("translates winner-fed codes (W branch)", () => {
    expect(placeholderLabel("W101", mockT)).toBe("Winner of Match 101");
    expect(mockT).toHaveBeenCalledWith("winnerMatch", { num: "101" });
  });

  it("translates loser-fed codes (L branch)", () => {
    expect(placeholderLabel("L101", mockT)).toBe("Loser of Match 101");
    expect(mockT).toHaveBeenCalledWith("loserMatch", { num: "101" });
  });

  it("translates group winner codes (group branch)", () => {
    expect(placeholderLabel("1A", mockT)).toBe("Winner of Group A");
    expect(mockT).toHaveBeenCalledWith("winnerGroup", { group: "A" });
  });

  it("translates group runner-up codes (runner-up branch)", () => {
    expect(placeholderLabel("2B", mockT)).toBe("Runner-up of Group B");
    expect(mockT).toHaveBeenCalledWith("runnerUpGroup", { group: "B" });
  });

  it("translates best third codes (best-third branch)", () => {
    expect(placeholderLabel("3ABCD", mockT)).toBe("Best 3rd of ABCD");
    expect(mockT).toHaveBeenCalledWith("bestThird", { groups: "ABCD" });

    expect(placeholderLabel("3A/B/C/D/F", mockT)).toBe("Best 3rd of A/B/C/D/F");
    expect(mockT).toHaveBeenCalledWith("bestThird", { groups: "A/B/C/D/F" });
  });

  it("falls back to the code itself for unknown formats", () => {
    expect(placeholderLabel("TBD", mockT)).toBe("TBD");
  });
});
