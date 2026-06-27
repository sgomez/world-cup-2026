import { err, ok, type Result } from "neverthrow";
import { SHOW_IMPORTED_NAMES } from "@/config/bet";
import { type DomainError, domainError } from "./errors";

export class BetLabel {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<BetLabel, DomainError> {
    const trimmed = raw.trim();
    if (!trimmed) return err(domainError("INVALID_LABEL"));
    if (trimmed.length > 200) return err(domainError("INVALID_LABEL"));
    return ok(new BetLabel(trimmed));
  }
}

export type SerializedBetLabel =
  | {
      obfuscated: false;
      value: string;
    }
  | {
      obfuscated: true;
      num: string;
      head: string;
      tail: string;
      middleLen: number;
    };

export function obfuscateLabel(label: string): SerializedBetLabel {
  const separatorIndex = label.indexOf(" | ");
  let num = "";
  let name = label;
  if (separatorIndex !== -1) {
    num = label.substring(0, separatorIndex);
    name = label.substring(separatorIndex + 3);
  }

  const isAlnum = (char: string) => /^[\p{L}\p{N}]$/u.test(char);

  const visibleCount = [...name].filter(isAlnum).length;
  if (visibleCount <= 4) {
    return {
      obfuscated: true,
      num,
      head: "",
      tail: "",
      middleLen: name.length,
    };
  }

  // Head/tail are confined to the first/last whitespace-delimited token, so a
  // trailing "CASA 1" exposes "1" rather than pulling "A" across the space.
  const tokens = name.split(/\s+/).filter(Boolean);
  const firstAlnum = [...tokens[0]].filter(isAlnum);
  const lastAlnum = [...tokens[tokens.length - 1]].filter(isAlnum);
  const head = firstAlnum.slice(0, 2).join("");
  const tail = lastAlnum.slice(-2).join("");

  return {
    obfuscated: true,
    num,
    head,
    tail,
    middleLen: name.length - head.length - tail.length,
  };
}

export function serializeLabel(
  label: string,
  imported: boolean,
  isOwner: boolean,
  showNames = SHOW_IMPORTED_NAMES,
): SerializedBetLabel {
  if (imported && !isOwner && !showNames) {
    return obfuscateLabel(label);
  }
  return { obfuscated: false, value: label };
}
