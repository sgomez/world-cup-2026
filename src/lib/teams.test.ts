import { describe, expect, it } from "vitest";
import { type GroupData, type Team, groups } from "./teams";

describe("groups", () => {
  it("exports all 12 groups A–L in order", () => {
    const letters = groups.map((g) => g.group);
    expect(letters).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]);
  });

  it("each group contains exactly 4 teams", () => {
    for (const g of groups) {
      expect(g.teams).toHaveLength(4);
    }
  });

  it("team id is fifa_code lowercased", () => {
    const mex = groups[0].teams[0];
    expect(mex.id).toBe("mex");
    const usa = groups.find((g) => g.group === "D")!.teams.find((t) => t.id === "usa");
    expect(usa).toBeDefined();
  });

  it("team name uses name_normalised when present", () => {
    const groupA = groups.find((g) => g.group === "A")!;
    const kor = groupA.teams.find((t) => t.id === "kor")!;
    expect(kor.name).toBe("Korea Republic");
  });

  it("team name falls back to name when name_normalised absent", () => {
    const groupA = groups.find((g) => g.group === "A")!;
    const mex = groupA.teams.find((t) => t.id === "mex")!;
    expect(mex.name).toBe("Mexico");
  });

  it("team flag uses flag_icon", () => {
    const groupA = groups.find((g) => g.group === "A")!;
    const mex = groupA.teams.find((t) => t.id === "mex")!;
    expect(mex.flag).toBe("🇲🇽");
  });

  it("team shape has only id, name, flag — no continent, flag_unicode, confed", () => {
    const team: Team = groups[0].teams[0];
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
