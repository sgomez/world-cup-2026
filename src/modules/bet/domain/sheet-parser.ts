export type ParsedRow = {
  rowNumber: number;
  col0: string;
  col1: string;
  predictions: Record<number, string>;
};

export interface SheetParser {
  parse(buffer: Buffer): Promise<ParsedRow[]>;
}
