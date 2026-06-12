import ExcelJS from "exceljs";
import type { ParsedRow, SheetParser } from "../domain/sheet-parser";

export class ExceljsSheetParser implements SheetParser {
  async parse(buffer: Buffer): Promise<ParsedRow[]> {
    const workbook = new ExcelJS.Workbook();
    // biome-ignore lint/suspicious/noExplicitAny: exceljs load method has a type mismatch with Node Buffer
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return [];
    }

    const parsedRows: ParsedRow[] = [];

    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const col0 = this.getCellValue(row.getCell(1));

      // A row counts as a participant row iff its first cell matches /^\d+[TPX]$/
      if (!/^\d+[TPX]$/.test(col0)) {
        return;
      }

      const col1 = this.getCellValue(row.getCell(2));

      const predictions: Record<number, string> = {};
      for (let colIndex = 2; colIndex <= 49; colIndex++) {
        // columns 2-49 (0-indexed) corresponds to cells 3-50 (1-indexed) in exceljs
        const cell = row.getCell(colIndex + 1);
        predictions[colIndex] = this.getCellValue(cell);
      }

      parsedRows.push({
        rowNumber,
        col0,
        col1,
        predictions,
      });
    });

    return parsedRows;
  }

  private getCellValue(cell: ExcelJS.Cell): string {
    if (cell.value === null || cell.value === undefined) {
      return "";
    }

    if (typeof cell.value === "object") {
      // Handle formulas
      if (
        "result" in cell.value &&
        cell.value.result !== undefined &&
        cell.value.result !== null
      ) {
        return String(cell.value.result).trim();
      }
      // Handle rich text
      if ("richText" in cell.value && Array.isArray(cell.value.richText)) {
        return cell.value.richText
          .map((rt) => rt.text || "")
          .join("")
          .trim();
      }
      return "";
    }

    return String(cell.value).trim();
  }
}
