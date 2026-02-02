import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setSprints } from './sprints.js';
import {
  epics,
  getEpicById,
  addEpic,
  addTeamToEpic,
  removeTeamFromEpic,
  setTeamInvolvement,
  setTeamDurationRange,
  addTeamNote,
  addTeamTodo,
  setAnnualizedEbitdaRange,
  setInYearEbitdaRange,
  setExpectedDeliveryStart,
  setValueDeliveryDate,
  setValueDeliveryLinked,
  setDependencyEnvironment,
  setInitiativeObjective,
  captureEpicSnapshot,
  restoreEpicFromSnapshot,
  copySnapshotToEpic,
  toggleEpicMetric,
  syncValueDeliveryToProjectEnd,
  bootstrapEpicIfEmpty,
  EBITDA_MAX,
} from './epics.js';
import { getDisplayValueForInYearEbitda } from './confidenceMode.js';

describe('getEpicById', () => {
  it('returns epic when found by id', () => {
    epics.length = 0;
    const epic = addEpic('Test Epic');
    const found = getEpicById(epic.id);
    assert.strictEqual(found?.id, epic.id);
    assert.strictEqual(found?.name, 'Test Epic');
  });

  it('returns null when epic not found', () => {
    epics.length = 0;
    const found = getEpicById(99999);
    assert.strictEqual(found, null);
  });

  it('returns epic when id is string (coerced to number)', () => {
    epics.length = 0;
    const epic = addEpic('String ID Epic');
    const found = getEpicById(String(epic.id));
    assert.strictEqual(found?.id, epic.id);
  });
});

describe('team assignments', () => {
  it('addTeamToEpic adds team and initializes involvement/duration', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    const assignment = addTeamToEpic(epic.id, 'eng');
    assert(assignment);
    assert.strictEqual(assignment.teamId, 'eng');
    assert.strictEqual(assignment.involvement, 0);
    assert.strictEqual(assignment.durationUnit, 'months');
    assert.strictEqual(assignment.durationMin, 1);
    assert.strictEqual(assignment.durationMax, 1);
    assert.strictEqual(assignment.involvementHistory?.length, 1);
    assert.deepStrictEqual(assignment.notes, []);
  });

  it('addTeamNote adds note to assignment', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    addTeamToEpic(epic.id, 'eng');
    addTeamNote(epic.id, 'eng', 'Test note');
    const found = getEpicById(epic.id);
    const a = found.teamAssignments.find((x) => x.teamId === 'eng');
    assert.strictEqual(a.notes.length, 1);
    assert.strictEqual(a.notes[0].text, 'Test note');
  });

  it('addTeamToEpic returns null if team already assigned', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    addTeamToEpic(epic.id, 'eng');
    const again = addTeamToEpic(epic.id, 'eng');
    assert.strictEqual(again, null);
  });

  it('setTeamInvolvement updates value and records history', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    addTeamToEpic(epic.id, 'eng');
    setTeamInvolvement(epic.id, 'eng', 2);
    const found = getEpicById(epic.id);
    const a = found.teamAssignments.find((x) => x.teamId === 'eng');
    assert.strictEqual(a.involvement, 2);
    assert.strictEqual(a.involvementHistory.length, 2);
  });

  it('setTeamDurationRange updates duration unit and range', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    addTeamToEpic(epic.id, 'eng');
    setTeamDurationRange(epic.id, 'eng', 'quarters', 2, 4);
    const found = getEpicById(epic.id);
    const a = found.teamAssignments.find((x) => x.teamId === 'eng');
    assert.strictEqual(a.durationUnit, 'quarters');
    assert.strictEqual(a.durationMin, 2);
    assert.strictEqual(a.durationMax, 4);
  });

  it('removeTeamFromEpic removes assignment', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    addTeamToEpic(epic.id, 'eng');
    const removed = removeTeamFromEpic(epic.id, 'eng');
    assert.strictEqual(removed, true);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.teamAssignments.length, 0);
  });
});

describe('financial and delivery fields', () => {
  it('setAnnualizedEbitdaRange updates range and records history', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    setAnnualizedEbitdaRange(epic.id, 20, 80);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.annualizedEbitda.min, 20);
    assert.strictEqual(found.annualizedEbitda.max, 80);
    assert(found.annualizedEbitda.minHistory.length >= 1);
    assert(found.annualizedEbitda.maxHistory.length >= 1);
  });

  it('setInYearEbitdaRange updates range and records history', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    setAnnualizedEbitdaRange(epic.id, 20, 80);
    setInYearEbitdaRange(epic.id, 10, 50);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.inYearEbitda.min, 10);
    assert.strictEqual(found.inYearEbitda.max, 50);
    assert.strictEqual(found.inYearEbitdaSet, true);
  });

  it('setExpectedDeliveryStart updates sprint range and records history', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    setExpectedDeliveryStart(epic.id, 's01', 's06');
    const found = getEpicById(epic.id);
    assert.strictEqual(found.expectedDeliveryStart.startSprintId, 's01');
    assert.strictEqual(found.expectedDeliveryStart.endSprintId, 's06');
    assert.strictEqual(found.expectedDeliveryStart.history.length, 1);
  });

  it('setValueDeliveryDate updates sprint range and records history', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    setValueDeliveryDate(epic.id, 's07', 's12');
    const found = getEpicById(epic.id);
    assert.strictEqual(found.valueDeliveryDate.startSprintId, 's07');
    assert.strictEqual(found.valueDeliveryDate.endSprintId, 's12');
    assert.strictEqual(found.valueDeliveryDate.history.length, 1);
  });

  it('syncValueDeliveryToProjectEnd updates valueDeliveryDate when linked', () => {
    setSprints([
      { id: 's01', label: 'S1', isBlocked: false },
      { id: 's02', label: 'S2', isBlocked: false },
      { id: 's03', label: 'S3', isBlocked: false },
      { id: 's04', label: 'S4', isBlocked: false },
      { id: 's05', label: 'S5', isBlocked: false },
      { id: 's06', label: 'S6', isBlocked: false },
      { id: 's07', label: 'S7', isBlocked: false },
      { id: 's08', label: 'S8', isBlocked: false },
    ]);
    epics.length = 0;
    const epic = addEpic('Epic');
    addTeamToEpic(epic.id, 'eng');
    setExpectedDeliveryStart(epic.id, 's02', 's04');
    syncValueDeliveryToProjectEnd(epic.id, { min: 2, max: 4 });
    const found = getEpicById(epic.id);
    assert.strictEqual(found.valueDeliveryDate.startSprintId, 's06');
    assert.strictEqual(found.valueDeliveryDate.endSprintId, 's08');
  });

  it('syncValueDeliveryToProjectEnd does not update Value when no teams (expectedSprints null)', () => {
    setSprints([
      { id: 's01', label: 'S1', isBlocked: false },
      { id: 's02', label: 'S2', isBlocked: false },
      { id: 's03', label: 'S3', isBlocked: false },
      { id: 's04', label: 'S4', isBlocked: false },
      { id: 's05', label: 'S5', isBlocked: false },
      { id: 's06', label: 'S6', isBlocked: false },
      { id: 's07', label: 'S7', isBlocked: false },
      { id: 's08', label: 'S8', isBlocked: false },
    ]);
    epics.length = 0;
    const epic = addEpic('Bootstrap Epic');
    setExpectedDeliveryStart(epic.id, 's03', 's05');
    setValueDeliveryDate(epic.id, 's04', 's06', true, true);
    syncValueDeliveryToProjectEnd(epic.id, null);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.valueDeliveryDate.startSprintId, 's04');
    assert.strictEqual(found.valueDeliveryDate.endSprintId, 's06');
  });

  it('User moves Expected min past Value min: Value max must NOT be set to Expected min', () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const sprints = JSON.parse(readFileSync(join(__dirname, 'sprints.json'), 'utf-8'));
    setSprints(sprints);
    epics.length = 0;
    const epic = addEpic('Epic');
    setValueDeliveryDate(epic.id, 's04', 's12');
    setExpectedDeliveryStart(epic.id, 's07', 's45');
    const found = getEpicById(epic.id);
    assert.strictEqual(found.valueDeliveryDate.startSprintId, 's07');
    assert.notStrictEqual(found.valueDeliveryDate.endSprintId, 's07');
    assert.strictEqual(found.valueDeliveryDate.endSprintId, 's12');
  });

  it('With or without teams: move Expected min preserves Value max (enforce only)', () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const sprints = JSON.parse(readFileSync(join(__dirname, 'sprints.json'), 'utf-8'));
    setSprints(sprints);
    epics.length = 0;
    const epic = addEpic('Epic');
    addTeamToEpic(epic.id, 'eng');
    setValueDeliveryDate(epic.id, 's04', 's12', true, true);
    setExpectedDeliveryStart(epic.id, 's07', 's45');
    const found = getEpicById(epic.id);
    assert.strictEqual(found.valueDeliveryDate.startSprintId, 's07');
    assert.strictEqual(found.valueDeliveryDate.endSprintId, 's12');
  });

  it('Value max before Value min: enforce does not run (min already after Expected min)', () => {
    setSprints([
      { id: 's01', label: 'S1', isBlocked: false },
      { id: 's02', label: 'S2', isBlocked: false },
      { id: 's03', label: 'S3', isBlocked: false },
      { id: 's04', label: 'S4', isBlocked: false },
      { id: 's05', label: 'S5', isBlocked: false },
      { id: 's06', label: 'S6', isBlocked: false },
      { id: 's07', label: 'S7', isBlocked: false },
      { id: 's08', label: 'S8', isBlocked: false },
    ]);
    epics.length = 0;
    const epic = addEpic('Epic');
    setExpectedDeliveryStart(epic.id, 's05', 's06');
    setValueDeliveryDate(epic.id, 's06', 's04');
    const found = getEpicById(epic.id);
    assert.strictEqual(found.valueDeliveryDate.startSprintId, 's06');
    assert.strictEqual(found.valueDeliveryDate.endSprintId, 's04');
  });

  it('Value min before Expected min, Value max after: only clamp min, max stays', () => {
    setSprints([
      { id: 's01', label: 'S1', isBlocked: false },
      { id: 's02', label: 'S2', isBlocked: false },
      { id: 's03', label: 'S3', isBlocked: false },
      { id: 's04', label: 'S4', isBlocked: false },
      { id: 's05', label: 'S5', isBlocked: false },
      { id: 's06', label: 'S6', isBlocked: false },
      { id: 's07', label: 'S7', isBlocked: false },
      { id: 's08', label: 'S8', isBlocked: false },
      { id: 's09', label: 'S9', isBlocked: false },
      { id: 's10', label: 'S10', isBlocked: false },
    ]);
    epics.length = 0;
    const epic = addEpic('Epic');
    setExpectedDeliveryStart(epic.id, 's05', 's06');
    setValueDeliveryDate(epic.id, 's01', 's10');
    const found = getEpicById(epic.id);
    assert.strictEqual(found.valueDeliveryDate.startSprintId, 's05');
    assert.strictEqual(found.valueDeliveryDate.endSprintId, 's10');
  });

  it('Value min before Expected min: clamp Value min to Expected min', () => {
    setSprints([
      { id: 's01', label: 'S1', isBlocked: false },
      { id: 's02', label: 'S2', isBlocked: false },
      { id: 's03', label: 'S3', isBlocked: false },
      { id: 's04', label: 'S4', isBlocked: false },
      { id: 's05', label: 'S5', isBlocked: false },
      { id: 's06', label: 'S6', isBlocked: false },
      { id: 's07', label: 'S7', isBlocked: false },
      { id: 's08', label: 'S8', isBlocked: false },
    ]);
    epics.length = 0;
    const epic = addEpic('Epic');
    setExpectedDeliveryStart(epic.id, 's05', 's06');
    setValueDeliveryDate(epic.id, 's01', 's08');
    const found = getEpicById(epic.id);
    assert.strictEqual(found.valueDeliveryDate.startSprintId, 's05');
    assert.strictEqual(found.valueDeliveryDate.endSprintId, 's08');
  });

  it('Value min and max before Expected min: clamp min only, leave max alone', () => {
    setSprints([
      { id: 's01', label: 'S1', isBlocked: false },
      { id: 's02', label: 'S2', isBlocked: false },
      { id: 's03', label: 'S3', isBlocked: false },
      { id: 's04', label: 'S4', isBlocked: false },
      { id: 's05', label: 'S5', isBlocked: false },
      { id: 's06', label: 'S6', isBlocked: false },
      { id: 's07', label: 'S7', isBlocked: false },
      { id: 's08', label: 'S8', isBlocked: false },
    ]);
    epics.length = 0;
    const epic = addEpic('Epic');
    setExpectedDeliveryStart(epic.id, 's05', 's06');
    setValueDeliveryDate(epic.id, 's01', 's03');
    const found = getEpicById(epic.id);
    assert.strictEqual(found.valueDeliveryDate.startSprintId, 's05');
    assert.strictEqual(found.valueDeliveryDate.endSprintId, 's03');
  });

  it('Default Value (s01-s25) and Expected set to s05-s06: clamp min only, max stays s25', () => {
    setSprints([
      { id: 's01', label: 'S1', isBlocked: false },
      { id: 's02', label: 'S2', isBlocked: false },
      { id: 's03', label: 'S3', isBlocked: false },
      { id: 's04', label: 'S4', isBlocked: false },
      { id: 's05', label: 'S5', isBlocked: false },
      { id: 's06', label: 'S6', isBlocked: false },
      { id: 's07', label: 'S7', isBlocked: false },
      { id: 's08', label: 'S8', isBlocked: false },
      { id: 's09', label: 'S9', isBlocked: false },
      { id: 's10', label: 'S10', isBlocked: false },
      { id: 's25', label: 'S25', isBlocked: false },
    ]);
    epics.length = 0;
    const epic = addEpic('Epic');
    setExpectedDeliveryStart(epic.id, 's05', 's06');
    const found = getEpicById(epic.id);
    assert.strictEqual(found.valueDeliveryDate.startSprintId, 's05');
    assert.strictEqual(found.valueDeliveryDate.endSprintId, 's25');
  });

  it('Expected moves past Value: clamp min only, leave max alone', () => {
    setSprints([
      { id: 's01', label: 'S1', isBlocked: false },
      { id: 's02', label: 'S2', isBlocked: false },
      { id: 's03', label: 'S3', isBlocked: false },
      { id: 's04', label: 'S4', isBlocked: false },
      { id: 's05', label: 'S5', isBlocked: false },
      { id: 's06', label: 'S6', isBlocked: false },
      { id: 's07', label: 'S7', isBlocked: false },
      { id: 's08', label: 'S8', isBlocked: false },
    ]);
    epics.length = 0;
    const epic = addEpic('Epic');
    setValueDeliveryDate(epic.id, 's01', 's03');
    setExpectedDeliveryStart(epic.id, 's05', 's06');
    const found = getEpicById(epic.id);
    assert.strictEqual(found.valueDeliveryDate.startSprintId, 's05');
    assert.strictEqual(found.valueDeliveryDate.endSprintId, 's03');
  });

  it('Value start after Expected start – no clamp', () => {
    setSprints([
      { id: 's01', label: 'S1', isBlocked: false },
      { id: 's02', label: 'S2', isBlocked: false },
      { id: 's03', label: 'S3', isBlocked: false },
      { id: 's04', label: 'S4', isBlocked: false },
      { id: 's05', label: 'S5', isBlocked: false },
      { id: 's06', label: 'S6', isBlocked: false },
      { id: 's07', label: 'S7', isBlocked: false },
      { id: 's08', label: 'S8', isBlocked: false },
    ]);
    epics.length = 0;
    const epic = addEpic('Epic');
    setExpectedDeliveryStart(epic.id, 's01', 's04');
    setValueDeliveryDate(epic.id, 's05', 's07');
    const found = getEpicById(epic.id);
    assert.strictEqual(found.valueDeliveryDate.startSprintId, 's05');
    assert.strictEqual(found.valueDeliveryDate.endSprintId, 's07');
  });

  it('Value start after Expected end – no clamp', () => {
    setSprints([
      { id: 's01', label: 'S1', isBlocked: false },
      { id: 's02', label: 'S2', isBlocked: false },
      { id: 's03', label: 'S3', isBlocked: false },
      { id: 's04', label: 'S4', isBlocked: false },
      { id: 's05', label: 'S5', isBlocked: false },
      { id: 's06', label: 'S6', isBlocked: false },
      { id: 's07', label: 'S7', isBlocked: false },
      { id: 's08', label: 'S8', isBlocked: false },
    ]);
    epics.length = 0;
    const epic = addEpic('Epic');
    setExpectedDeliveryStart(epic.id, 's01', 's03');
    setValueDeliveryDate(epic.id, 's05', 's07');
    const found = getEpicById(epic.id);
    assert.strictEqual(found.valueDeliveryDate.startSprintId, 's05');
    assert.strictEqual(found.valueDeliveryDate.endSprintId, 's07');
  });

  it('syncValueDeliveryToProjectEnd does not update when valueDeliveryLinked is false', () => {
    setSprints([
      { id: 's01', label: 'S1', isBlocked: false },
      { id: 's02', label: 'S2', isBlocked: false },
      { id: 's03', label: 'S3', isBlocked: false },
      { id: 's04', label: 'S4', isBlocked: false },
      { id: 's05', label: 'S5', isBlocked: false },
    ]);
    epics.length = 0;
    const epic = addEpic('Epic');
    setValueDeliveryDate(epic.id, 's03', 's05');
    setExpectedDeliveryStart(epic.id, 's01', 's02');
    syncValueDeliveryToProjectEnd(epic.id, { min: 2, max: 3 });
    const found = getEpicById(epic.id);
    assert.strictEqual(found.valueDeliveryDate.startSprintId, 's03');
    assert.strictEqual(found.valueDeliveryDate.endSprintId, 's05');
  });

  it('setExpectedDeliveryStart snaps blocked sprint start to next non-blocked', () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const sprints = JSON.parse(readFileSync(join(__dirname, 'sprints.json'), 'utf-8'));
    setSprints(sprints);
    epics.length = 0;
    const epic = addEpic('Epic');
    setExpectedDeliveryStart(epic.id, 'ip1', 's07');
    const found = getEpicById(epic.id);
    assert.strictEqual(found.expectedDeliveryStart.startSprintId, 's07');
    assert.strictEqual(found.expectedDeliveryStart.endSprintId, 's07');
  });

  it('bootstrapEpicIfEmpty adds epic when empty', () => {
    epics.length = 0;
    bootstrapEpicIfEmpty();
    assert.strictEqual(epics.length, 1);
    assert.strictEqual(epics[0].name, 'Bootstrap Epic');
  });

  it('bootstrapEpicIfEmpty does nothing when epics exist', () => {
    epics.length = 0;
    addEpic('Existing');
    bootstrapEpicIfEmpty();
    assert.strictEqual(epics.length, 1);
    assert.strictEqual(epics[0].name, 'Existing');
  });
});

describe('snapshot capture and restore', () => {
  beforeEach(() => {
    setSprints([
      { id: 's01', label: 'S1', isBlocked: false },
      { id: 's02', label: 'S2', isBlocked: false },
      { id: 's03', label: 'S3', isBlocked: false },
      { id: 's04', label: 'S4', isBlocked: false },
      { id: 's05', label: 'S5', isBlocked: false },
      { id: 's06', label: 'S6', isBlocked: false },
    ]);
  });

  it('captures and restores name and status', () => {
    epics.length = 0;
    const epic = addEpic('Original Name');
    setInitiativeObjective(epic.id, '');
    epic.status = 'In Progress';
    captureEpicSnapshot(epic.id, '');
    epic.name = 'Changed Name';
    epic.status = 'Done';
    restoreEpicFromSnapshot(epic.id, 0);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.name, 'Original Name');
    assert.strictEqual(found.status, 'In Progress');
  });

  it('captures and restores initiativeObjective', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    setInitiativeObjective(epic.id, 'Build the thing');
    captureEpicSnapshot(epic.id, '');
    setInitiativeObjective(epic.id, 'Different objective');
    restoreEpicFromSnapshot(epic.id, 0);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.initiativeObjective, 'Build the thing');
  });

  it('captures and restores teamAssignments with involvement and duration', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    addTeamToEpic(epic.id, 'eng');
    addTeamToEpic(epic.id, 'design');
    setTeamInvolvement(epic.id, 'eng', 2);
    setTeamDurationRange(epic.id, 'eng', 'quarters', 2, 4);
    captureEpicSnapshot(epic.id, '');
    removeTeamFromEpic(epic.id, 'design');
    setTeamInvolvement(epic.id, 'eng', 0);
    setTeamDurationRange(epic.id, 'eng', 'weeks', 1, 2);
    restoreEpicFromSnapshot(epic.id, 0);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.teamAssignments.length, 2);
    const eng = found.teamAssignments.find((a) => a.teamId === 'eng');
    assert.strictEqual(eng.involvement, 2);
    assert.strictEqual(eng.durationUnit, 'quarters');
    assert.strictEqual(eng.durationMin, 2);
    assert.strictEqual(eng.durationMax, 4);
  });

  it('captures and restores team notes', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    addTeamToEpic(epic.id, 'eng');
    addTeamNote(epic.id, 'eng', 'Note one');
    addTeamNote(epic.id, 'eng', 'Note two');
    captureEpicSnapshot(epic.id, '');
    addTeamNote(epic.id, 'eng', 'Note three');
    restoreEpicFromSnapshot(epic.id, 0);
    const found = getEpicById(epic.id);
    const a = found.teamAssignments.find((x) => x.teamId === 'eng');
    assert.strictEqual(a.notes.length, 2);
    assert.strictEqual(a.notes[0].text, 'Note one');
    assert.strictEqual(a.notes[1].text, 'Note two');
  });

  it('captures and restores team todos with risk', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    addTeamToEpic(epic.id, 'eng');
    addTeamTodo(epic.id, 'eng', 'Todo A', 'high');
    addTeamTodo(epic.id, 'eng', 'Todo B', 'low');
    captureEpicSnapshot(epic.id, '');
    addTeamTodo(epic.id, 'eng', 'Todo C', 'medium');
    restoreEpicFromSnapshot(epic.id, 0);
    const found = getEpicById(epic.id);
    const a = found.teamAssignments.find((x) => x.teamId === 'eng');
    assert.strictEqual(a.todos.length, 2);
    assert.strictEqual(a.todos[0].text, 'Todo A');
    assert.strictEqual(a.todos[0].risk, 'high');
    assert.strictEqual(a.todos[1].text, 'Todo B');
    assert.strictEqual(a.todos[1].risk, 'low');
  });

  it('captures and restores annualizedEbitda and inYearEbitda', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    setAnnualizedEbitdaRange(epic.id, 30, 70);
    setInYearEbitdaRange(epic.id, 15, 40);
    captureEpicSnapshot(epic.id, '');
    setAnnualizedEbitdaRange(epic.id, 0, 10);
    setInYearEbitdaRange(epic.id, 5, 8);
    restoreEpicFromSnapshot(epic.id, 0);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.annualizedEbitda.min, 30);
    assert.strictEqual(found.annualizedEbitda.max, 70);
    assert.strictEqual(found.inYearEbitda.min, 15);
    assert.strictEqual(found.inYearEbitda.max, 40);
    assert.strictEqual(found.inYearEbitdaSet, true);
  });

  it('captures and restores expectedDeliveryStart and valueDeliveryDate', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    setExpectedDeliveryStart(epic.id, 's02', 's04');
    setValueDeliveryDate(epic.id, 's03', 's06');
    captureEpicSnapshot(epic.id, '');
    setExpectedDeliveryStart(epic.id, 's01', 's01');
    setValueDeliveryDate(epic.id, 's01', 's02');
    restoreEpicFromSnapshot(epic.id, 0);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.expectedDeliveryStart.startSprintId, 's02');
    assert.strictEqual(found.expectedDeliveryStart.endSprintId, 's04');
    assert.strictEqual(found.valueDeliveryDate.startSprintId, 's03');
    assert.strictEqual(found.valueDeliveryDate.endSprintId, 's06');
  });

  it('captures and restores dependencyEnvironment', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    setDependencyEnvironment(epic.id, 2);
    captureEpicSnapshot(epic.id, '');
    setDependencyEnvironment(epic.id, 0);
    restoreEpicFromSnapshot(epic.id, 0);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.dependencyEnvironment, 2);
  });

  it('captures and restores valueDeliveryLinked', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    setValueDeliveryDate(epic.id, 's02', 's04');
    captureEpicSnapshot(epic.id, '');
    setValueDeliveryLinked(epic.id, true);
    restoreEpicFromSnapshot(epic.id, 0);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.valueDeliveryLinked, false);
  });

  it('captures and restores metrics', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    toggleEpicMetric(epic.id, 'revenue-impact');
    toggleEpicMetric(epic.id, 'nps-satisfaction');
    captureEpicSnapshot(epic.id, '');
    toggleEpicMetric(epic.id, 'revenue-impact');
    toggleEpicMetric(epic.id, 'time-to-market');
    restoreEpicFromSnapshot(epic.id, 0);
    const found = getEpicById(epic.id);
    assert.deepStrictEqual(found.metrics.sort(), ['nps-satisfaction', 'revenue-impact']);
  });

  it('copySnapshotToEpic creates current snapshot then restores target', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    setInitiativeObjective(epic.id, 'Original');
    captureEpicSnapshot(epic.id, '');
    setInitiativeObjective(epic.id, 'Modified');
    captureEpicSnapshot(epic.id, '');
    setInitiativeObjective(epic.id, 'Latest');
    const ok = copySnapshotToEpic(epic.id, 0);
    assert.strictEqual(ok, true);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.initiativeObjective, 'Original');
    assert.strictEqual(found.snapshots.length, 3);
  });

  it('restoreEpicFromSnapshot returns false for invalid snapshot', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    const ok = restoreEpicFromSnapshot(epic.id, 99);
    assert.strictEqual(ok, false);
  });
});

describe('confidence mode transitions', () => {
  beforeEach(() => {
    setSprints([
      { id: 's01', label: 'S1', isBlocked: false },
      { id: 's02', label: 'S2', isBlocked: false },
      { id: 's03', label: 'S3', isBlocked: false },
      { id: 's04', label: 'S4', isBlocked: false },
      { id: 's05', label: 'S5', isBlocked: false },
      { id: 's06', label: 'S6', isBlocked: false },
      { id: 's07', label: 'S7', isBlocked: false },
      { id: 's08', label: 'S8', isBlocked: false },
      { id: 's09', label: 'S9', isBlocked: false },
      { id: 's10', label: 'S10', isBlocked: false },
      { id: 's25', label: 'S25', isBlocked: false },
    ]);
  });

  it('setter with (v,v) produces min===max for EBITDA', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    setAnnualizedEbitdaRange(epic.id, 25, 25);
    setInYearEbitdaRange(epic.id, 10, 10);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.annualizedEbitda.min, 25);
    assert.strictEqual(found.annualizedEbitda.max, 25);
    assert.strictEqual(found.inYearEbitda.min, 10);
    assert.strictEqual(found.inYearEbitda.max, 10);
  });

  it('setter with (v,v) produces startSprintId===endSprintId for timeline', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    setExpectedDeliveryStart(epic.id, 's05', 's05');
    setValueDeliveryDate(epic.id, 's10', 's10');
    const found = getEpicById(epic.id);
    assert.strictEqual(found.expectedDeliveryStart.startSprintId, 's05');
    assert.strictEqual(found.expectedDeliveryStart.endSprintId, 's05');
    assert.strictEqual(found.valueDeliveryDate.startSprintId, 's10');
    assert.strictEqual(found.valueDeliveryDate.endSprintId, 's10');
  });

  it('setter with (v,v) produces durationMin===durationMax for sprints unit', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    addTeamToEpic(epic.id, 'eng');
    setTeamDurationRange(epic.id, 'eng', 'sprints', 4, 4);
    const found = getEpicById(epic.id);
    const a = found.teamAssignments.find((x) => x.teamId === 'eng');
    assert.strictEqual(a.durationMin, 4);
    assert.strictEqual(a.durationMax, 4);
  });

  it('round-trip: ranges to high confidence - EBITDA uses min', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    setAnnualizedEbitdaRange(epic.id, 10, 90);
    setAnnualizedEbitdaRange(epic.id, 10, 10);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.annualizedEbitda.min, 10);
    assert.strictEqual(found.annualizedEbitda.max, 10);
  });

  it('round-trip: ranges to high confidence - timeline uses start', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    setExpectedDeliveryStart(epic.id, 's02', 's08');
    setExpectedDeliveryStart(epic.id, 's02', 's02');
    const found = getEpicById(epic.id);
    assert.strictEqual(found.expectedDeliveryStart.startSprintId, 's02');
    assert.strictEqual(found.expectedDeliveryStart.endSprintId, 's02');
  });

  it('round-trip: ranges to high confidence - duration uses min', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    addTeamToEpic(epic.id, 'eng');
    setTeamDurationRange(epic.id, 'eng', 'months', 2, 6);
    setTeamDurationRange(epic.id, 'eng', 'months', 2, 2);
    const found = getEpicById(epic.id);
    const a = found.teamAssignments.find((x) => x.teamId === 'eng');
    assert.strictEqual(a.durationMin, 2);
    assert.strictEqual(a.durationMax, 2);
  });

  it('round-trip: high confidence to ranges - data unchanged when min===max', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    addTeamToEpic(epic.id, 'eng');
    setAnnualizedEbitdaRange(epic.id, 50, 50);
    setExpectedDeliveryStart(epic.id, 's05', 's05');
    setValueDeliveryDate(epic.id, 's06', 's06');
    setTeamDurationRange(epic.id, 'eng', 'quarters', 3, 3);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.annualizedEbitda.min, 50);
    assert.strictEqual(found.annualizedEbitda.max, 50);
    assert.strictEqual(found.expectedDeliveryStart.startSprintId, 's05');
    assert.strictEqual(found.expectedDeliveryStart.endSprintId, 's05');
    assert.strictEqual(found.teamAssignments[0].durationMin, 3);
    assert.strictEqual(found.teamAssignments[0].durationMax, 3);
  });

  it('edge case: zero EBITDA survives toggle', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    setAnnualizedEbitdaRange(epic.id, 0, 0);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.annualizedEbitda.min, 0);
    assert.strictEqual(found.annualizedEbitda.max, 0);
  });

  it('edge case: max EBITDA survives toggle', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    setAnnualizedEbitdaRange(epic.id, EBITDA_MAX, EBITDA_MAX);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.annualizedEbitda.min, EBITDA_MAX);
    assert.strictEqual(found.annualizedEbitda.max, EBITDA_MAX);
  });

  it('edge case: In Year display value capped by ann per helper', () => {
    const inYear = { min: 50, max: 70 };
    const ann = { min: 20, max: 80 };
    assert.strictEqual(getDisplayValueForInYearEbitda(inYear, ann), 20);
  });

  it('edge case: inYear max clamped to ann max by setter', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    setAnnualizedEbitdaRange(epic.id, 30, 30);
    setInYearEbitdaRange(epic.id, 50, 50);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.inYearEbitda.max, 30);
  });

  it('edge case: sprints unit stores single value', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    addTeamToEpic(epic.id, 'eng');
    setTeamDurationRange(epic.id, 'eng', 'sprints', 5, 5);
    const found = getEpicById(epic.id);
    const a = found.teamAssignments.find((x) => x.teamId === 'eng');
    assert.strictEqual(a.durationUnit, 'sprints');
    assert.strictEqual(a.durationMin, 5);
    assert.strictEqual(a.durationMax, 5);
  });

  it('edge case: single sprint timeline boundaries', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    setExpectedDeliveryStart(epic.id, 's01', 's01');
    setValueDeliveryDate(epic.id, 's25', 's25');
    const found = getEpicById(epic.id);
    assert.strictEqual(found.expectedDeliveryStart.startSprintId, 's01');
    assert.strictEqual(found.expectedDeliveryStart.endSprintId, 's01');
    assert.strictEqual(found.valueDeliveryDate.startSprintId, 's25');
    assert.strictEqual(found.valueDeliveryDate.endSprintId, 's25');
  });

  it('snapshot preserves high-confidence data (min===max)', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    addTeamToEpic(epic.id, 'eng');
    setAnnualizedEbitdaRange(epic.id, 40, 40);
    setInYearEbitdaRange(epic.id, 20, 20);
    setExpectedDeliveryStart(epic.id, 's03', 's03');
    setValueDeliveryDate(epic.id, 's05', 's05');
    setTeamDurationRange(epic.id, 'eng', 'months', 4, 4);
    captureEpicSnapshot(epic.id, '');
    setAnnualizedEbitdaRange(epic.id, 0, 100);
    setExpectedDeliveryStart(epic.id, 's01', 's08');
    setTeamDurationRange(epic.id, 'eng', 'weeks', 1, 6);
    restoreEpicFromSnapshot(epic.id, 0);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.annualizedEbitda.min, 40);
    assert.strictEqual(found.annualizedEbitda.max, 40);
    assert.strictEqual(found.inYearEbitda.min, 20);
    assert.strictEqual(found.inYearEbitda.max, 20);
    assert.strictEqual(found.expectedDeliveryStart.startSprintId, 's03');
    assert.strictEqual(found.expectedDeliveryStart.endSprintId, 's03');
    assert.strictEqual(found.teamAssignments[0].durationMin, 4);
    assert.strictEqual(found.teamAssignments[0].durationMax, 4);
  });

  it('toggle without edit: data unchanged', () => {
    epics.length = 0;
    const epic = addEpic('Epic');
    setAnnualizedEbitdaRange(epic.id, 10, 90);
    const found = getEpicById(epic.id);
    assert.strictEqual(found.annualizedEbitda.min, 10);
    assert.strictEqual(found.annualizedEbitda.max, 90);
  });
});
