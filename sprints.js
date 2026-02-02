// Sprints loaded from sprints.json
let sprintsData = null;

export async function loadSprints() {
  if (sprintsData) return sprintsData;
  const res = await fetch('/sprints.json');
  if (!res.ok) throw new Error(`Failed to load sprints: ${res.status}`);
  sprintsData = await res.json();
  return sprintsData;
}

export function setSprints(sprints) {
  sprintsData = sprints;
}

export function getSprints() {
  return sprintsData ?? [];
}

export function getSprintById(id) {
  if (!sprintsData) return null;
  return sprintsData.find((s) => s.id === id) ?? null;
}

export function getNextNonBlockedIndex(fromIndex) {
  if (!sprintsData) return fromIndex;
  for (let i = fromIndex; i < sprintsData.length; i++) {
    if (!sprintsData[i].isBlocked) return i;
  }
  return sprintsData.length - 1;
}
