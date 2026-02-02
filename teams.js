// Teams loaded from teams.json
let teamsData = null;

export async function loadTeams() {
  if (teamsData) return teamsData;
  const res = await fetch('/teams.json');
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
