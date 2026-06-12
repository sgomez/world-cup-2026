import { okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";
import type {
  ImportOwnerProvisioner,
  ProvisionedOwner,
} from "../../community/domain/import-owner-provisioner";
import { InMemoryCommunityRepository } from "../../community/infrastructure/in-memory-community-repository";
import type { ParsedRow, SheetParser } from "../domain/sheet-parser";
import { InMemoryBetRepository } from "../infrastructure/in-memory-bet-repository";
import { importDirectBets } from "./import-direct-bets";

class FakeSheetParser implements SheetParser {
  constructor(private readonly rows: ParsedRow[]) {}
  async parse(_buffer: Buffer): Promise<ParsedRow[]> {
    return this.rows;
  }
}

class FakeImportOwnerProvisioner implements ImportOwnerProvisioner {
  constructor(
    private readonly owner: ProvisionedOwner = {
      id: "owner-123",
      name: "Imported Community",
      email: "owner-123@example.com",
    },
  ) {}
  provision(_communityName: string) {
    return okAsync(this.owner);
  }
}

describe("importDirectBets application service", () => {
  it("successfully creates imported community and maps good bets under a single owner", async () => {
    const communityRepo = new InMemoryCommunityRepository();
    const betRepo = new InMemoryBetRepository();
    const ownerProvisioner = new FakeImportOwnerProvisioner();

    // 1T: MEX (G) -> MEX champion, MEX in all rounds (R32, R16, QF, SF, F)
    // 2P: USA (D) -> USA only in R32
    const rows: ParsedRow[] = [
      {
        rowNumber: 3,
        col0: "1T",
        col1: "Participant A",
        predictions: {
          2: "G", // Column 2 = MEX
        },
      },
      {
        rowNumber: 4,
        col0: "2P",
        col1: "Participant B",
        predictions: {
          14: "D", // Column 14 = USA
        },
      },
    ];

    const sheetParser = new FakeSheetParser(rows);
    const command = {
      communityName: "My Imported Community",
      fileBuffer: Buffer.from("fake"),
      inviteToken: "token-abc-123",
    };

    const result = await importDirectBets(
      sheetParser,
      ownerProvisioner,
      communityRepo,
      betRepo,
      command,
    );

    expect(result.isOk()).toBe(true);
    const val = result._unsafeUnwrap();
    expect(val.community.name).toBe("My Imported Community");
    expect(val.community.imported).toBe(true);
    expect(val.community.ownerId).toBe("owner-123");
    expect(val.community.memberIds).toEqual(["owner-123"]);
    expect(val.skippedRows).toHaveLength(0);

    // Verify bets are saved in repo and owned by owner-123
    const bets = await betRepo.listByOwner("owner-123");
    expect(bets).toHaveLength(2);

    const betA = bets.find((b) => b.label === "1T | Participant A");
    expect(betA).toBeDefined();
    expect(betA?.status).toBe("closed");
    expect(betA?.directPredictions?.champion).toBe("mex");

    const betB = bets.find((b) => b.label === "2P | Participant B");
    expect(betB).toBeDefined();
    expect(betB?.status).toBe("closed");
    expect(betB?.directPredictions?.champion).toBeNull();
    expect(betB?.directPredictions?.R32).toEqual(["usa"]);
  });

  it("handles skipped rows gracefully and imports the good ones", async () => {
    const communityRepo = new InMemoryCommunityRepository();
    const betRepo = new InMemoryBetRepository();
    const ownerProvisioner = new FakeImportOwnerProvisioner();

    const rows: ParsedRow[] = [
      {
        rowNumber: 3,
        col0: "1T",
        col1: "Participant A",
        predictions: {
          2: "G", // Good row
        },
      },
      {
        rowNumber: 4,
        col0: "invalid-id", // Malformed col0 (violates /^\d+[TPX]$/)
        col1: "Participant B",
        predictions: {
          2: "G",
        },
      },
      {
        rowNumber: 5,
        col0: "3P",
        col1: "Participant C",
        predictions: {
          2: "Z", // Unknown letter
        },
      },
    ];

    const sheetParser = new FakeSheetParser(rows);
    const command = {
      communityName: "Skipped Rows test",
      fileBuffer: Buffer.from("fake"),
      inviteToken: "token-abc-123",
    };

    const result = await importDirectBets(
      sheetParser,
      ownerProvisioner,
      communityRepo,
      betRepo,
      command,
    );

    expect(result.isOk()).toBe(true);
    const val = result._unsafeUnwrap();
    expect(val.skippedRows).toHaveLength(2);
    expect(val.skippedRows[0].rowNumber).toBe(4);
    expect(val.skippedRows[0].reason).toContain("Malformed row identifier");
    expect(val.skippedRows[1].rowNumber).toBe(5);
    expect(val.skippedRows[1].reason).toContain("Unknown prediction letter");

    // Only one good bet should be saved
    const bets = await betRepo.listByOwner("owner-123");
    expect(bets).toHaveLength(1);
    expect(bets[0].label).toBe("1T | Participant A");
  });

  it("returns error on empty or invalid file", async () => {
    const communityRepo = new InMemoryCommunityRepository();
    const betRepo = new InMemoryBetRepository();
    const ownerProvisioner = new FakeImportOwnerProvisioner();

    const sheetParser = new FakeSheetParser([]);
    const command = {
      communityName: "Empty Sheet",
      fileBuffer: Buffer.from("fake"),
      inviteToken: "token-abc-123",
    };

    const result = await importDirectBets(
      sheetParser,
      ownerProvisioner,
      communityRepo,
      betRepo,
      command,
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_SHEET");
  });
});
