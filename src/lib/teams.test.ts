import { describe, expect, it } from "vitest";
import { type GroupData, groups, type Team } from "./teams";

const groupA = groups[0];
const groupD = groups[3];

describe("groups", () => {
  it("exports all 12 groups A–L in order", () => {
    const letters = groups.map((g) => g.group);
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
    for (const g of groups) {
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

  it("GroupData shape has group and teams", () => {
    const g: GroupData = groups[0];
    expect(g).toHaveProperty("group");
    expect(g).toHaveProperty("teams");
  });
});
