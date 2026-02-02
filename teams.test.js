import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTeams, getTeamById, getTeams } from './teams.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('teams', () => {
  it('getTeamById returns team when found', () => {
    const teams = [
      { id: 'eng', name: 'Engineering' },
      { id: 'design', name: 'Design' },
    ];
    setTeams(teams);
    const found = getTeamById('eng');
    assert.strictEqual(found?.id, 'eng');
    assert.strictEqual(found?.name, 'Engineering');
  });

  it('getTeamById returns null when not found', () => {
    setTeams([{ id: 'eng', name: 'Engineering' }]);
    const found = getTeamById('unknown');
    assert.strictEqual(found, null);
  });

  it('getTeams returns all teams', () => {
    const teams = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    setTeams(teams);
    assert.deepStrictEqual(getTeams(), teams);
  });

  it('teams.json has valid structure with id, name, teamSize, totalTeamCost', () => {
    const path = join(__dirname, 'teams.json');
    const raw = readFileSync(path, 'utf-8');
    const teams = JSON.parse(raw);
    assert(Array.isArray(teams), 'teams.json should be an array');
    assert(teams.length > 0, 'teams.json should not be empty');
    for (const t of teams) {
      assert(t.id, `Team should have id: ${JSON.stringify(t)}`);
      assert(t.name, `Team should have name: ${JSON.stringify(t)}`);
      assert(typeof t.teamSize === 'number', `Team should have teamSize (number): ${JSON.stringify(t)}`);
      assert(t.teamSize >= 5 && t.teamSize <= 12, `Team teamSize should be 5-12: ${t.teamSize}`);
      assert(typeof t.totalTeamCost === 'number', `Team should have totalTeamCost (number): ${JSON.stringify(t)}`);
      const salaryPerPerson = t.totalTeamCost / t.teamSize;
      assert(salaryPerPerson >= 140000 && salaryPerPerson <= 200000,
        `Salary per person (totalTeamCost/teamSize) should be 140000-200000, got ${salaryPerPerson} for ${t.id}`);
    }
  });
});
