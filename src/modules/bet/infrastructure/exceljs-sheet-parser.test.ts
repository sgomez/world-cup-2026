import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { ExceljsSheetParser } from "./exceljs-sheet-parser";

describe("ExceljsSheetParser", () => {
  it("should parse participant rows and ignore metadata/header/footer rows", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Pronósticos");

    // Row 1: Group letters mapping (Metadata) - IGNORED
    sheet.addRow([null, null, "A", "A", "A", "A", "B", "B", "B", "B"]);

    // Row 2: Header - IGNORED
    sheet.addRow([
      "Nº",
      "BOTE NOMBRE",
      "MEXICO",
      "SUDAFRICA",
      "COREA",
      "REP. CHECA",
      "CANADA",
      "BOSNIA",
      "QATAR",
      "SUIZA",
    ]);

    // Row 3: Valid participant row - CAPTURED
    // First cell matches /^\d+[TPX]$/, second cell name.
    // Let's populate predictions in columns 2 to 49.
    const row3Data = ["1T", "CHACHO 1"];
    for (let i = 2; i <= 49; i++) {
      // let's put "D" in MEX (2), "O" in RSA (3), and so on
      if (i === 2) row3Data.push("G");
      else if (i === 3) row3Data.push("F");
      else if (i === 4) row3Data.push("B");
      else if (i === 5) row3Data.push("S");
      else row3Data.push("");
    }
    sheet.addRow(row3Data);

    // Row 4: Valid participant row with different marker - CAPTURED
    const row4Data = ["52X", "CHACHO 2"];
    for (let i = 2; i <= 49; i++) {
      if (i === 2) row4Data.push("D");
      else if (i === 3) row4Data.push("O");
      else row4Data.push("");
    }
    sheet.addRow(row4Data);

    // Row 5: Footer/Instructions row - IGNORED
    sheet.addRow(["Total", "100", "", "", "", "", "", "", "", ""]);

    // Row 6: Legend row - IGNORED
    sheet.addRow(["D: R32", "O: R16", "", "", "", "", "", "", "", ""]);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const parser = new ExceljsSheetParser();
    const results = await parser.parse(buffer);

    expect(results).toHaveLength(2);

    // Assert Row 3
    const parsedRow3 = results[0];
    expect(parsedRow3.rowNumber).toBe(3);
    expect(parsedRow3.col0).toBe("1T");
    expect(parsedRow3.col1).toBe("CHACHO 1");
    expect(parsedRow3.predictions[2]).toBe("G");
    expect(parsedRow3.predictions[3]).toBe("F");
    expect(parsedRow3.predictions[4]).toBe("B");
    expect(parsedRow3.predictions[5]).toBe("S");
    expect(parsedRow3.predictions[6]).toBe("");
    expect(parsedRow3.predictions[49]).toBe("");

    // Assert Row 4
    const parsedRow4 = results[1];
    expect(parsedRow4.rowNumber).toBe(4);
    expect(parsedRow4.col0).toBe("52X");
    expect(parsedRow4.col1).toBe("CHACHO 2");
    expect(parsedRow4.predictions[2]).toBe("D");
    expect(parsedRow4.predictions[3]).toBe("O");
    expect(parsedRow4.predictions[4]).toBe("");
  });
});
