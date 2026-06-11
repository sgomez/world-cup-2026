import rawTeamsEn from "../../data/worldcup.teams.en.json";
import rawTeamsEs from "../../data/worldcup.teams.es.json";

export type Team = {
  id: string;
  name: string;
  flag: string;
  code: string;
};

export type GroupData = {
  group: string;
  teams: Team[];
};

type RawTeam = {
  name: string;
  name_normalised?: string;
  continent: string;
  flag_icon: string;
  fifa_code: string;
  iso_code: string;
  group: string;
  confed: string;
};

function buildGroups(rawTeams: RawTeam[]): GroupData[] {
  const teamsByGroup = rawTeams.reduce<Record<string, Team[]>>((acc, t) => {
    const team: Team = {
      id: t.fifa_code.toLowerCase(),
      name: t.name_normalised ?? t.name,
      flag: t.flag_icon,
      code: t.iso_code,
    };
    const g = t.group;
    if (!acc[g]) acc[g] = [];
    acc[g].push(team);
    return acc;
  }, {});

  return ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"].map(
    (g) => ({ group: g, teams: teamsByGroup[g] ?? [] }),
  );
}

const groupsByLocale: Record<string, GroupData[]> = {
  en: buildGroups(rawTeamsEn as RawTeam[]),
  es: buildGroups(rawTeamsEs as RawTeam[]),
};

export function getGroups(locale: string): GroupData[] {
  return groupsByLocale[locale] ?? groupsByLocale.en;
}

export function getTeamByName(name: string, locale: string): Team | null {
  const normalizedSearch = name.trim().toLowerCase();

  // Find in English raw teams first to get the key (fifa_code)
  const rawEn = (rawTeamsEn as RawTeam[]).find(
    (t) =>
      t.name.toLowerCase() === normalizedSearch ||
      t.name_normalised?.toLowerCase() === normalizedSearch,
  );

  if (!rawEn) return null;
  const targetId = rawEn.fifa_code.toLowerCase();

  // Find the translated team in the groups of the current locale
  for (const group of getGroups(locale)) {
    const found = group.teams.find((t) => t.id === targetId);
    if (found) return found;
  }

  return null;
}

export function getTeamById(id: string, locale: string): Team | null {
  for (const group of getGroups(locale)) {
    const found = group.teams.find((t) => t.id === id);
    if (found) return found;
  }
  return null;
}
