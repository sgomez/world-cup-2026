const MIN_MATCH_NUM = 1;
const MAX_MATCH_NUM = 104;

export function isValidNum(num: number): boolean {
  return Number.isInteger(num) && num >= MIN_MATCH_NUM && num <= MAX_MATCH_NUM;
}
