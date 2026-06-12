import type { ResultAsync } from "neverthrow";
import type { DomainError } from "./errors";

export type ProvisionedOwner = {
  id: string;
  name: string;
  email: string;
};

export interface ImportOwnerProvisioner {
  provision(communityName: string): ResultAsync<ProvisionedOwner, DomainError>;
}
