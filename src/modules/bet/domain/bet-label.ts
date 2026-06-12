import { err, ok, type Result } from "neverthrow";
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

  const letters: { char: string; index: number }[] = [];
  for (let i = 0; i < name.length; i++) {
    const char = name[i];
    if (/^\p{L}$/u.test(char)) {
      letters.push({ char, index: i });
    }
  }

  const letterCount = letters.length;
  if (letterCount <= 4) {
    return {
      obfuscated: true,
      num,
      head: "",
      tail: "",
      middleLen: name.length,
    };
  }

  const head = letters[0].char + letters[1].char;
  const tail = letters[letterCount - 2].char + letters[letterCount - 1].char;

  return {
    obfuscated: true,
    num,
    head,
    tail,
    middleLen: name.length - 4,
  };
}

export function serializeLabel(
  label: string,
  imported: boolean,
  isOwner: boolean,
): SerializedBetLabel {
  if (imported && !isOwner) {
    return obfuscateLabel(label);
  }
  return { obfuscated: false, value: label };
}
