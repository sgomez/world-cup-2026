# World Cup 2026 Bets Import File Format (Excel/CSV)

This document describes the structure of the community bets sheet (`Pronóstico.xlsx` / `Pronóstico.csv`) used to import external predictions into the internal database.

---

## 1. Document Structure

The file is structured as a table with group-indexed country columns. It contains header metadata, participant rows, checksum columns, and a legend footer.

### Row-by-Row Layout:
1. **Row 1 (Metadata)**: Group letters mapping (e.g., `,,"A",,,,"B",...`). **Ignore** this row during import.
2. **Row 2 (Header)**:
   - **Column 0**: `Nº` (ID column header)
   - **Column 1**: `BOTE <value> NOMBRE` (Participant name header)
   - **Columns 2 to 49 (48 columns)**: Names of the 48 participating countries in Group order (from Group A, Team 1 to Group L, Team 4).
   - **Columns 50 to 57**: Checksum column headers: `D`, `O`, `C`, `S`, `F`, `B`, `G`, `T`. **Ignore** these columns.
3. **Rows 3 to 193 (Participant Predictions)**:
   - Each valid data row starts with a numeric ID followed by `T`, `P`, or `X` (e.g., `1T`, `52X`). Rows not matching this pattern (e.g., footer or metadata rows) must be ignored.
4. **Footer Rows**: Instructions, totals, and legend descriptions (e.g., lines starting with `D:`, `O:`, etc.). **Ignore** these rows.

---

## 2. Columns to FIFA Codes Mapping

The 48 country columns (Columns 2 to 49, 0-indexed) must be converted into their respective 3-letter FIFA codes. The column sequence is in exact Group order:

| Col Index | Sheet Country Name | FIFA Code | Group |
|---|---|---|---|
| 2 | MEXICO | MEX | A |
| 3 | SUDAFRICA | RSA | A |
| 4 | COREA | KOR | A |
| 5 | REP. CHECA | CZE | A |
| 6 | CANADA | CAN | B |
| 7 | BOSNIA | BIH | B |
| 8 | QATAR | QAT | B |
| 9 | SUIZA | SUI | B |
| 10 | BRASIL | BRA | C |
| 11 | MARRUECOS | MAR | C |
| 12 | HAITI | HAI | C |
| 13 | ESCOCIA | SCO | C |
| 14 | USA | USA | D |
| 15 | PARAGUAY | PAR | D |
| 16 | AUSTRALIA | AUS | D |
| 17 | TURQUIA | TUR | D |
| 18 | ALEMANIA | GER | E |
| 19 | CURAÇAO | CUW | E |
| 20 | COSTA MARFIL | CIV | E |
| 21 | ECUADOR | ECU | E |
| 22 | HOLANDA | NED | F *(Países Bajos)* |
| 23 | JAPON | JPN | F |
| 24 | SUECIA | SWE | F |
| 25 | TUNEZ | TUN | F |
| 26 | BELGICA | BEL | G |
| 27 | EGIPTO | EGY | G |
| 28 | IRAN | IRN | G |
| 29 | N.ZELANDA | NZL | G |
| 30 | ESPAÑA | ESP | H |
| 31 | CABO VERDE | CPV | H |
| 32 | ARABIA S. | KSA | H |
| 33 | URUGUAY | URU | H |
| 34 | FRANCIA | FRA | I |
| 35 | SENEGAL | SEN | I |
| 36 | IRAK | IRQ | I |
| 37 | NORUEGA | NOR | I |
| 38 | ARGENTINA | ARG | J |
| 39 | ARGELIA | ALG | J |
| 40 | AUSTRIA | AUT | J |
| 41 | JORDANIA | JOR | J |
| 42 | PORTUGAL | POR | K |
| 43 | CONGO | COD | K *(Congo RD)* |
| 44 | UZBEKISTAN | UZB | K |
| 45 | COLOMBIA | COL | K |
| 46 | INGLATERRA | ENG | L |
| 47 | CROACIA | CRO | L |
| 48 | GHANA | GHA | L |
| 49 | PANAMA | PAN | L |

---

## 3. Prediction Code Meanings

For each country column, a character value represents the stage of elimination or progression:
* **`D`**: Round of 32 (eliminated in 1/16 de Final)
* **`O`**: Round of 16 (eliminated in 1/8 de Final)
* **`C`**: Quarter-finals (eliminated in 1/4 de Final)
* **`S`**: Semi-finals (eliminated in Semifinal)
* **`B`**: 3rd Place Match Winner (Bronce)
* **`F`**: Final Runner-Up (Finalist)
* **`G`**: Champion (Ganador of the Final)

---

## 4. Round Aggregation Rules

When converting prediction letters to JSON round lists, teams must cascade down into all previous rounds they reached.
- **R32 list** includes all teams with: `D`, `O`, `C`, `S`, `F`, `B`, `G`
- **R16 list** includes all teams with: `O`, `C`, `S`, `F`, `B`, `G`
- **QF list** includes all teams with: `C`, `S`, `F`, `B`, `G`
- **SF list** includes all teams with: `S`, `F`, `B`, `G`
- **Final list** includes all teams with: `F`, `G`
- **winner_3rd** (string or null): the team with `B`
- **winner_final** (string or null): the team with `G`

### Robustness & Deduplication:
1. **Never Skip Broken Bets**: Do not ignore rows with validation errors (e.g. where the total team count in a round is not standard due to a participant omitting predictions).
2. **Deduplicate Round Lists**: If a participant made a mistake and added the same country twice in the same round, the round lists must be **deduplicated** (e.g. using `set(round_list)`). Only unique team codes must populate each round array.

---

## 5. Output JSON Schema Example

The parsed file outputs a JSON array of participant documents structured as follows:

```json
[
  {
    "id": "1T",
    "label": "CHACHO 1",
    "R32": [
      "MEX", "KOR", "CZE", "CAN", "BIH", "SUI", "BRA", "MAR", "SCO", "USA",
      "PAR", "TUR", "GER", "CIV", "ECU", "NED", "JPN", "SWE", "BEL", "EGY",
      "NZL", "ESP", "URU", "FRA", "SEN", "NOR", "ARG", "AUT", "POR", "COL",
      "ENG", "CRO"
    ],
    "R16": [
      "MEX", "KOR", "SUI", "BRA", "USA", "TUR", "GER", "NED", "BEL", "ESP",
      "FRA", "NOR", "ARG", "POR", "ENG", "CRO"
    ],
    "QF": [
      "BRA", "GER", "NED", "BEL", "ESP", "ARG", "POR", "ENG"
    ],
    "SF": [
      "BRA", "GER", "ESP", "ARG"
    ],
    "Final": [
      "BRA", "ESP"
    ],
    "winner_3rd": "GER",
    "winner_final": "ESP"
  }
]
```
