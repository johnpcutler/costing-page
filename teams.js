// Teams loaded from teams.json
let teamsData = null;

export async function loadTeams() {
  if (teamsData) return teamsData;
  const url = new URL('teams.json', import.meta.url).href;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load teams: ${res.status}`);
  teamsData = await res.json();
  return teamsData;
}

export function setTeams(teams) {
  teamsData = teams;
}

export function getTeamById(id) {
  if (!teamsData) return null;
  return teamsData.find((t) => t.id === id) ?? null;
}

export function getTeams() {
  return teamsData ?? [];
}
