import { errAsync, ResultAsync } from "neverthrow";
import { Community } from "../../community/domain/community";
import { CommunityName } from "../../community/domain/community-name";
import type { CommunityRepository } from "../../community/domain/community-repository";
import { CommunitySlug } from "../../community/domain/community-slug";
import type { ImportOwnerProvisioner } from "../../community/domain/import-owner-provisioner";
import { Bet } from "../domain/bet";
import type { BetRepository } from "../domain/bet-repository";
import {
  type SkipReason,
  transformParsedRow,
} from "../domain/cascade-transform";
import {
  type DomainError,
  type DomainErrorCode,
  domainError,
} from "../domain/errors";
import type { SheetParser } from "../domain/sheet-parser";

export type ImportDirectBetsCommand = {
  communityName: string;
  fileBuffer: Buffer;
  inviteToken: string;
};

export type ImportDirectBetsResult = {
  community: Community;
  skippedRows: SkipReason[];
};

export function importDirectBets(
  sheetParser: SheetParser,
  ownerProvisioner: ImportOwnerProvisioner,
  communityRepo: CommunityRepository,
  betRepo: BetRepository,
  command: ImportDirectBetsCommand,
): ResultAsync<ImportDirectBetsResult, DomainError> {
  return ResultAsync.fromPromise(sheetParser.parse(command.fileBuffer), () =>
    domainError("INVALID_SHEET"),
  ).andThen((parsedRows) => {
    if (parsedRows.length === 0) {
      return errAsync<ImportDirectBetsResult, DomainError>(
        domainError("INVALID_SHEET"),
      );
    }

    const nameResult = CommunityName.create(command.communityName);
    if (nameResult.isErr()) {
      return errAsync<ImportDirectBetsResult, DomainError>({
        code: nameResult.error.code as DomainErrorCode,
      });
    }
    const name = nameResult.value;

    const slugResult = CommunitySlug.derive(name.value);
    if (slugResult.isErr()) {
      return errAsync<ImportDirectBetsResult, DomainError>({
        code: slugResult.error.code as DomainErrorCode,
      });
    }
    const slugBase = slugResult.value.value;

    const findUniqueSlug = async (base: string): Promise<string> => {
      const existing = await communityRepo.findBySlug(base);
      if (!existing) return base;

      let counter = 2;
      while (true) {
        const candidate = `${base}-${counter}`;
        const taken = await communityRepo.findBySlug(candidate);
        if (!taken) return candidate;
        counter++;
      }
    };

    return ResultAsync.fromSafePromise(findUniqueSlug(slugBase)).andThen(
      (uniqueSlugStr) => {
        const slugVoResult = CommunitySlug.create(uniqueSlugStr);
        if (slugVoResult.isErr()) {
          return errAsync<ImportDirectBetsResult, DomainError>({
            code: slugVoResult.error.code as DomainErrorCode,
          });
        }
        const slugVo = slugVoResult.value;

        return ownerProvisioner
          .provision(command.communityName)
          .mapErr((e) => ({ code: e.code as DomainErrorCode }))
          .andThen((owner) => {
            const community = Community.createImported(
              name,
              slugVo,
              owner.id,
              command.inviteToken,
            );

            const skippedRows: SkipReason[] = [];
            const goodBets: Bet[] = [];

            for (const parsedRow of parsedRows) {
              const transformResult = transformParsedRow(parsedRow);
              if (transformResult.isErr()) {
                skippedRows.push(transformResult.error);
                continue;
              }
              const predictions = transformResult.value;

              const label = `${parsedRow.col0} | ${parsedRow.col1}`;
              const betResult = Bet.createDirect(label, owner.id, predictions);
              if (betResult.isErr()) {
                skippedRows.push({
                  rowNumber: parsedRow.rowNumber,
                  reason: betResult.error.code,
                });
                continue;
              }

              goodBets.push(betResult.value);
            }

            return communityRepo
              .save(community)
              .mapErr((e) => ({ code: e.code as DomainErrorCode }))
              .andThen(() => {
                const savePromises = goodBets.map((bet) => betRepo.save(bet));
                return ResultAsync.combine(savePromises);
              })
              .map(() => ({
                community,
                skippedRows,
              }));
          });
      },
    );
  });
}
