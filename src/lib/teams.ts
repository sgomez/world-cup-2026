import rawTeams from "../../data/worldcup.teams.json";

export type Team = {
  id: string;
  name: string;
  flag: string;
};

export type GroupData = {
  group: string;
  teams: Team[];
};

const teamsByGroup = rawTeams.reduce<Record<string, Team[]>>((acc, t) => {
  const team: Team = {
    id: t.fifa_code.toLowerCase(),
    name: "name_normalised" in t && t.name_normalised ? t.name_normalised : t.name,
    flag: t.flag_icon,
  };
  const g = t.group;
  if (!acc[g]) acc[g] = [];
  acc[g].push(team);
  return acc;
}, {});

export const groups: GroupData[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"].map(
  (g) => ({ group: g, teams: teamsByGroup[g] ?? [] }),
);
