import { randomUUID } from "node:crypto";
import { okAsync, type ResultAsync } from "neverthrow";
import type { DomainError } from "../domain/errors";
import type {
  ImportOwnerProvisioner,
  ProvisionedOwner,
} from "../domain/import-owner-provisioner";

export class InMemoryImportOwnerProvisioner implements ImportOwnerProvisioner {
  private provisioned: ProvisionedOwner[] = [];

  constructor(private readonly nextOwner?: Partial<ProvisionedOwner>) {}

  provision(communityName: string): ResultAsync<ProvisionedOwner, DomainError> {
    const owner: ProvisionedOwner = {
      id: this.nextOwner?.id ?? `owner-${randomUUID()}`,
      name: this.nextOwner?.name ?? communityName,
      email: this.nextOwner?.email ?? `owner-${randomUUID()}@example.com`,
    };
    this.provisioned.push(owner);
    return okAsync(owner);
  }

  getData(): ProvisionedOwner[] {
    return [...this.provisioned];
  }

  setData(data: ProvisionedOwner[]) {
    this.provisioned = [...data];
  }
}
