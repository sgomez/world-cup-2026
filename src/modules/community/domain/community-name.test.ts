import { describe, expect, it } from "vitest";
import { CommunityName } from "./community-name";

describe("CommunityName Value Object", () => {
  it("creates a valid CommunityName when name is clean", () => {
    const result = CommunityName.create("My Awesome Community");
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().value).toBe("My Awesome Community");
  });

  it("trims whitespace", () => {
    const result = CommunityName.create("   Trim Me   ");
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().value).toBe("Trim Me");
  });

  it("fails if name is empty", () => {
    const result = CommunityName.create("   ");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_NAME");
  });

  it("fails if name is too long (over 200 characters)", () => {
    const longName = "a".repeat(201);
    const result = CommunityName.create(longName);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_NAME");
  });

  it("fails if name contains only non-alphanumeric characters", () => {
    const result = CommunityName.create("!!!");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_NAME");
  });
});
