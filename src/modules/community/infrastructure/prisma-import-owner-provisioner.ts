import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { ResultAsync } from "neverthrow";
import type { DomainError } from "../domain/errors";
import { domainError } from "../domain/errors";
import type {
  ImportOwnerProvisioner,
  ProvisionedOwner,
} from "../domain/import-owner-provisioner";

type UserClient = Pick<PrismaClient, "user">;

export class PrismaImportOwnerProvisioner implements ImportOwnerProvisioner {
  constructor(private readonly prisma: UserClient) {}

  provision(communityName: string): ResultAsync<ProvisionedOwner, DomainError> {
    const id = randomUUID();
    const email = `${randomUUID()}@example.com`;

    return ResultAsync.fromPromise(
      this.prisma.user.create({
        data: {
          id,
          name: communityName,
          email,
          emailVerified: true,
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
      () => domainError("SAVE_FAILED"),
    ).map(() => ({
      id,
      name: communityName,
      email,
    }));
  }
}
