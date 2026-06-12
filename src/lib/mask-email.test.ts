import { describe, expect, it } from "vitest";
import { maskEmail } from "./mask-email";

describe("maskEmail", () => {
  it("masks the local part and domain label, keeping first chars and TLD", () => {
    expect(maskEmail("domino@gmail.com")).toBe("d*****@g****.com");
  });

  it("keeps multi-segment TLDs intact", () => {
    expect(maskEmail("sergio@example.co.uk")).toBe("s*****@e******.co.uk");
  });

  it("handles single-character local and domain labels", () => {
    expect(maskEmail("a@b.com")).toBe("a@b.com");
  });

  it("masks subdomains as part of the domain label", () => {
    expect(maskEmail("ab@mail.test.org")).toBe("a*@m***.test.org");
  });

  it("returns the input unchanged when there is no @", () => {
    expect(maskEmail("not-an-email")).toBe("not-an-email");
  });

  it("returns empty string for empty input", () => {
    expect(maskEmail("")).toBe("");
  });
});
