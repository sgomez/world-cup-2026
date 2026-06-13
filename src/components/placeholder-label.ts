/**
 * Translates a bracket placeholder code (e.g. "W101", "L101", "2A", "3ABCD", etc.)
 * into a localized display string using the provided translation function `t`.
 */
// biome-ignore lint/suspicious/noExplicitAny: t is the next-intl translator function
export function placeholderLabel(code: string, t: any): string {
  const matchWinner = code.match(/^W(\d+)$/);
  if (matchWinner) {
    return t("winnerMatch", { num: matchWinner[1] });
  }

  const matchLoser = code.match(/^L(\d+)$/);
  if (matchLoser) {
    return t("loserMatch", { num: matchLoser[1] });
  }

  const matchGroup = code.match(/^([12])([A-L])$/);
  if (matchGroup) {
    const position = matchGroup[1];
    const group = matchGroup[2];
    if (position === "1") {
      return t("winnerGroup", { group });
    }
    return t("runnerUpGroup", { group });
  }

  if (code.startsWith("3")) {
    const groups = code.substring(1);
    return t("bestThird", { groups });
  }

  return code;
}
