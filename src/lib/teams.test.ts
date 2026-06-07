import { describe, expect, it } from "vitest";
import { type GroupData, getGroups, type Team } from "./teams";

const enGroups = getGroups("en");
const esGroups = getGroups("es");
const groupA = enGroups[0];
const groupD = enGroups[3];

describe("getGroups", () => {
  it("exports all 12 groups A–L in order", () => {
    const letters = enGroups.map((g) => g.group);
    expect(letters).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
    ]);
  });

  it("each group contains exactly 4 teams", () => {
    for (const g of enGroups) {
      expect(g.teams).toHaveLength(4);
    }
  });

  it("team id is fifa_code lowercased", () => {
    expect(groupA.teams[0].id).toBe("mex");
    const usa = groupD.teams.find((t) => t.id === "usa");
    expect(usa).toBeDefined();
  });

  it("team name uses name_normalised when present", () => {
    const kor = groupA.teams.find((t) => t.id === "kor");
    expect(kor?.name).toBe("Korea Republic");
  });

  it("team name falls back to name when name_normalised absent", () => {
    expect(groupA.teams[0].name).toBe("Mexico");
  });

  it("team flag uses flag_icon", () => {
    expect(groupA.teams[0].flag).toBe("🇲🇽");
  });

  it("team shape has only id, name, flag — no continent, flag_unicode, confed", () => {
    const team: Team = groupA.teams[0];
    const keys = Object.keys(team);
    expect(keys).toEqual(expect.arrayContaining(["id", "name", "flag"]));
    expect(keys).not.toContain("continent");
    expect(keys).not.toContain("flag_unicode");
    expect(keys).not.toContain("confed");
  });

  it("team shape includes code", () => {
    const team: Team = groupA.teams[0];
    expect(team).toHaveProperty("code");
    expect(typeof team.code).toBe("string");
    expect(team.code.length).toBeGreaterThan(0);
  });

  it("team code is correct for a standard team (Mexico = mx)", () => {
    const mex = groupA.teams.find((t) => t.id === "mex");
    expect(mex?.code).toBe("mx");
  });

  it("England code is gb-eng (sub-national, not derivable from emoji)", () => {
    const groupL = enGroups[11];
    const eng = groupL.teams.find((t) => t.id === "eng");
    expect(eng?.code).toBe("gb-eng");
  });

  it("team code is present and non-empty in es locale", () => {
    const kor = esGroups[0].teams.find((t) => t.id === "kor");
    expect(kor?.code).toBe("kr");
  });

  it("GroupData shape has group and teams", () => {
    const g: GroupData = enGroups[0];
    expect(g).toHaveProperty("group");
    expect(g).toHaveProperty("teams");
  });
});

describe("getGroups Spanish locale", () => {
  it("South Korea returns Corea del Sur in es", () => {
    const kor = esGroups[0].teams.find((t) => t.id === "kor");
    expect(kor?.name).toBe("Corea del Sur");
  });

  it("Germany returns Alemania in es", () => {
    const ger = esGroups[4].teams.find((t) => t.id === "ger");
    expect(ger?.name).toBe("Alemania");
  });

  it("Netherlands returns Países Bajos in es", () => {
    const ned = esGroups[5].teams.find((t) => t.id === "ned");
    expect(ned?.name).toBe("Países Bajos");
  });

  it("England returns Inglaterra in es", () => {
    const eng = esGroups[11].teams.find((t) => t.id === "eng");
    expect(eng?.name).toBe("Inglaterra");
  });

  it("Brazil returns Brasil in es", () => {
    const bra = esGroups[2].teams.find((t) => t.id === "bra");
    expect(bra?.name).toBe("Brasil");
  });

  it("Switzerland returns Suiza in es", () => {
    const sui = esGroups[1].teams.find((t) => t.id === "sui");
    expect(sui?.name).toBe("Suiza");
  });

  it("en locale preserves original English names", () => {
    const kor = enGroups[0].teams.find((t) => t.id === "kor");
    expect(kor?.name).toBe("Korea Republic");
    const ger = enGroups[4].teams.find((t) => t.id === "ger");
    expect(ger?.name).toBe("Germany");
  });
});
