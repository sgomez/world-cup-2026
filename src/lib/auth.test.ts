import { beforeEach, describe, expect, it, vi } from "vitest";
import { promoteFirstRegistrant } from "@/modules/user/application/promote-first-registrant";
import { PrismaUserRepository } from "@/modules/user/infrastructure/prisma-user-repository";
import { auth } from "./auth";

vi.mock("@/modules/user/infrastructure/prisma-user-repository");
vi.mock("@/modules/user/application/promote-first-registrant");

describe("auth database hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes promoteFirstRegistrant service in afterCreate hook", async () => {
    const hook = (auth as any).options?.databaseHooks?.user?.create?.after;
    expect(hook).toBeDefined();

    const mockUser = { id: "user-999", email: "test@example.com" };
    await hook(mockUser);

    expect(PrismaUserRepository).toHaveBeenCalled();
    expect(promoteFirstRegistrant).toHaveBeenCalledWith(expect.any(Object), {
      userId: "user-999",
    });
  });
});
