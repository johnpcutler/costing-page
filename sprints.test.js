import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setSprints, getSprints, getSprintById, getNextNonBlockedIndex } from './sprints.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('sprints', () => {
  it('getSprintById returns sprint when found', () => {
    setSprints([{ id: 's01', label: 'S1', isBlocked: false }]);
    const found = getSprintById('s01');
    assert.strictEqual(found?.id, 's01');
  });

  it('getNextNonBlockedIndex returns next non-blocked index', () => {
    setSprints([
      { id: 'a', isBlocked: false },
      { id: 'ip1', isBlocked: true },
      { id: 'c', isBlocked: false },
    ]);
    assert.strictEqual(getNextNonBlockedIndex(1), 2);
  });

  it('sprints.json has valid structure', () => {
    const raw = readFileSync(join(__dirname, 'sprints.json'), 'utf-8');
    const sprints = JSON.parse(raw);
    assert(Array.isArray(sprints));
    assert(sprints.length > 0);
    for (const s of sprints) {
      assert(s.id);
      assert(s.label);
      assert(typeof s.isBlocked === 'boolean');
    }
  });
});
