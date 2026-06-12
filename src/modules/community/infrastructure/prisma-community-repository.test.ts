import { describe, expect, it, vi } from "vitest";
import { Community } from "../domain/community";
import { CommunityName } from "../domain/community-name";
import { CommunitySlug } from "../domain/community-slug";
import { PrismaCommunityRepository } from "./prisma-community-repository";

const ROW = {
  id: "comm-1",
  name: "My Community",
  slug: "my-community",
  ownerId: "owner-1",
  inviteToken: "token-1",
  imported: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  members: [{ userId: "owner-1" }],
};

const IMPORTED_ROW = {
  ...ROW,
  id: "comm-2",
  slug: "my-imported-community",
  imported: true,
};

function fakePrisma() {
  const mockTx = {
    community: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    communityMember: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({}),
    },
  };
  return {
    community: {
      findUnique: vi.fn(),
    },
    communityMember: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(mockTx)),
    mockTx,
  };
}

describe("PrismaCommunityRepository.findById", () => {
  it("maps a native community row into a Community aggregate", async () => {
    const prisma = fakePrisma();
    prisma.community.findUnique.mockResolvedValue(ROW);
    const repo = new PrismaCommunityRepository(prisma as never);

    const comm = await repo.findById("comm-1");

    expect(comm?.toState()).toEqual({
      id: ROW.id,
      name: ROW.name,
      slug: ROW.slug,
      ownerId: ROW.ownerId,
      inviteToken: ROW.inviteToken,
      imported: false,
      memberIds: ["owner-1"],
      createdAt: ROW.createdAt,
      updatedAt: ROW.updatedAt,
    });
    expect(prisma.community.findUnique).toHaveBeenCalledWith({
      where: { id: "comm-1" },
      include: {
        members: {
          select: { userId: true },
        },
      },
    });
  });

  it("maps an imported community row into a Community aggregate", async () => {
    const prisma = fakePrisma();
    prisma.community.findUnique.mockResolvedValue(IMPORTED_ROW);
    const repo = new PrismaCommunityRepository(prisma as never);

    const comm = await repo.findById("comm-2");

    expect(comm?.toState()).toEqual({
      id: IMPORTED_ROW.id,
      name: IMPORTED_ROW.name,
      slug: IMPORTED_ROW.slug,
      ownerId: IMPORTED_ROW.ownerId,
      inviteToken: IMPORTED_ROW.inviteToken,
      imported: true,
      memberIds: ["owner-1"],
      createdAt: IMPORTED_ROW.createdAt,
      updatedAt: IMPORTED_ROW.updatedAt,
    });
  });

  it("returns null when the row is absent", async () => {
    const prisma = fakePrisma();
    prisma.community.findUnique.mockResolvedValue(null);
    const repo = new PrismaCommunityRepository(prisma as never);

    expect(await repo.findById("missing")).toBeNull();
  });
});

describe("PrismaCommunityRepository.findBySlug", () => {
  it("maps a row into a Community aggregate", async () => {
    const prisma = fakePrisma();
    prisma.community.findUnique.mockResolvedValue(ROW);
    const repo = new PrismaCommunityRepository(prisma as never);

    const comm = await repo.findBySlug("my-community");

    expect(comm?.toState()).toEqual({
      id: ROW.id,
      name: ROW.name,
      slug: ROW.slug,
      ownerId: ROW.ownerId,
      inviteToken: ROW.inviteToken,
      imported: false,
      memberIds: ["owner-1"],
      createdAt: ROW.createdAt,
      updatedAt: ROW.updatedAt,
    });
    expect(prisma.community.findUnique).toHaveBeenCalledWith({
      where: { slug: "my-community" },
      include: {
        members: {
          select: { userId: true },
        },
      },
    });
  });
});

describe("PrismaCommunityRepository.findByInviteToken", () => {
  it("maps a row into a Community aggregate", async () => {
    const prisma = fakePrisma();
    prisma.community.findUnique.mockResolvedValue(ROW);
    const repo = new PrismaCommunityRepository(prisma as never);

    const comm = await repo.findByInviteToken("token-1");

    expect(comm?.toState()).toEqual({
      id: ROW.id,
      name: ROW.name,
      slug: ROW.slug,
      ownerId: ROW.ownerId,
      inviteToken: ROW.inviteToken,
      imported: false,
      memberIds: ["owner-1"],
      createdAt: ROW.createdAt,
      updatedAt: ROW.updatedAt,
    });
    expect(prisma.community.findUnique).toHaveBeenCalledWith({
      where: { inviteToken: "token-1" },
      include: {
        members: {
          select: { userId: true },
        },
      },
    });
  });
});

describe("PrismaCommunityRepository.save", () => {
  const name = CommunityName.create("My Community")._unsafeUnwrap();
  const slug = CommunitySlug.create("my-community")._unsafeUnwrap();

  it("round-trips a native aggregate back to its row columns via upsert", async () => {
    const prisma = fakePrisma();
    const repo = new PrismaCommunityRepository(prisma as never);
    const comm = Community.create(name, slug, "owner-1", "token-1");

    const result = await repo.save(comm);

    expect(result.isOk()).toBe(true);
    expect(prisma.mockTx.community.upsert).toHaveBeenCalledWith({
      where: { id: comm.id },
      create: {
        id: comm.id,
        name: "My Community",
        slug: "my-community",
        ownerId: "owner-1",
        inviteToken: "token-1",
        imported: false,
      },
      update: {
        name: "My Community",
        slug: "my-community",
        ownerId: "owner-1",
        inviteToken: "token-1",
        imported: false,
      },
    });
  });

  it("round-trips an imported aggregate back to its row columns via upsert", async () => {
    const prisma = fakePrisma();
    const repo = new PrismaCommunityRepository(prisma as never);
    const comm = Community.createImported(name, slug, "owner-1", "token-1");

    const result = await repo.save(comm);

    expect(result.isOk()).toBe(true);
    expect(prisma.mockTx.community.upsert).toHaveBeenCalledWith({
      where: { id: comm.id },
      create: {
        id: comm.id,
        name: "My Community",
        slug: "my-community",
        ownerId: "owner-1",
        inviteToken: "token-1",
        imported: true,
      },
      update: {
        name: "My Community",
        slug: "my-community",
        ownerId: "owner-1",
        inviteToken: "token-1",
        imported: true,
      },
    });
  });
});
