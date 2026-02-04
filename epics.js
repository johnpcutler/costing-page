// Epic store - shared between app and tests
import { getSprints, getSprintById, getNextNonBlockedIndex } from './sprints.js';

export const INVOLVEMENT_LABELS = ['Individual', 'Half Team', 'Full Team'];
export const DURATION_UNITS = ['weeks', 'months', 'quarters', 'years', 'sprints'];
export const DURATION_UNIT_LABELS = ['Weeks', 'Months', 'Quarters', 'Years', 'Sprints'];
export const DURATION_RANGE_MAX = { weeks: 6, months: 6, quarters: 6, years: 3, sprints: 50 };
export const DEPENDENCY_LABELS = [
  'Teams can work and deliver value independently',
  'Light collaboration with infrequent synchronization',
  'High collaboration between teams, but parallelization possible',
  'Phase gate, sequential coordination',
];

export const EBITDA_MAX = 100; // slider 0-100 = $0 to $10M ($100k per unit)

export const RISK_LABELS = ['Low', 'Medium', 'High'];
export const RISK_VALUES = ['low', 'medium', 'high'];

export const DEFAULT_METRICS = [
  { id: 'revenue-impact', label: 'Revenue Impact', category: 'financial' },
  { id: 'ebitda-contribution', label: 'EBITDA Contribution', category: 'financial' },
  { id: 'cost-reduction', label: 'Cost Reduction', category: 'financial' },
  { id: 'margin-improvement', label: 'Margin Improvement', category: 'financial' },
  { id: 'nps-satisfaction', label: 'NPS / Satisfaction', category: 'customer' },
  { id: 'support-ticket-reduction', label: 'Support Ticket Reduction', category: 'customer' },
  { id: 'feature-adoption', label: 'Feature Adoption', category: 'product' },
  { id: 'retention-rate', label: 'Retention Rate', category: 'product' },
  { id: 'churn-reduction', label: 'Churn Reduction', category: 'product' },
  { id: 'time-to-market', label: 'Time to Market', category: 'operational' },
  { id: 'operational-efficiency', label: 'Operational Efficiency', category: 'operational' },
  { id: 'risk-reduction', label: 'Risk Reduction', category: 'operational' },
  { id: 'market-expansion', label: 'Market Expansion', category: 'growth' },
  { id: 'user-growth', label: 'User Growth', category: 'growth' },
  { id: 'conversion-rate', label: 'Conversion Rate', category: 'growth' },
];

export const QUICK_ADD_METRIC_IDS = ['revenue-impact', 'nps-satisfaction', 'retention-rate', 'time-to-market', 'cost-reduction', 'feature-adoption'];

export const epics = [];

function defaultEbitdaRange() {
  const now = Date.now();
  return {
    min: 0,
    max: 0,
    minHistory: [{ value: 0, at: now }],
    maxHistory: [{ value: 0, at: now }],
  };
}

const DEFAULT_SPRINT_START = 's01';
const DEFAULT_SPRINT_END = 's25';

function defaultSprintRange() {
  return { startSprintId: DEFAULT_SPRINT_START, endSprintId: DEFAULT_SPRINT_END, history: [] };
}

export function getEpicById(id) {
  const numericId = Number(id);
  const epic = epics.find((e) => e.id === numericId) ?? null;
  if (epic) {
    if (!epic.annualizedEbitda) epic.annualizedEbitda = defaultEbitdaRange();
    if (!epic.inYearEbitda) epic.inYearEbitda = defaultEbitdaRange();
    if (!epic.expectedDeliveryStart || 'start' in epic.expectedDeliveryStart) epic.expectedDeliveryStart = defaultSprintRange();
    else if (epic.expectedDeliveryStart.startSprintId == null && epic.expectedDeliveryStart.endSprintId == null) {
      epic.expectedDeliveryStart.startSprintId = DEFAULT_SPRINT_START;
      epic.expectedDeliveryStart.endSprintId = DEFAULT_SPRINT_END;
    }
    if (!epic.valueDeliveryDate || 'start' in epic.valueDeliveryDate) epic.valueDeliveryDate = defaultSprintRange();
    else if (epic.valueDeliveryDate.startSprintId == null && epic.valueDeliveryDate.endSprintId == null) {
      epic.valueDeliveryDate.startSprintId = DEFAULT_SPRINT_START;
      epic.valueDeliveryDate.endSprintId = DEFAULT_SPRINT_END;
    }
    if (epic.dependencyEnvironment == null) epic.dependencyEnvironment = 0;
    if (epic.inYearEbitdaSet == null) epic.inYearEbitdaSet = false;
    if (epic.valueDeliveryLinked == null) epic.valueDeliveryLinked = true;
    if (epic.initiativeObjective == null) epic.initiativeObjective = '';
    if (!Array.isArray(epic.snapshots)) epic.snapshots = [];
    if (!Array.isArray(epic.metrics)) epic.metrics = [];
    for (const a of epic.teamAssignments ?? []) {
      if (a.duration != null && a.durationUnit == null) {
        const map = [
          { unit: 'weeks', min: 1, max: 1 },
          { unit: 'months', min: 1, max: 1 },
          { unit: 'quarters', min: 1, max: 1 },
          { unit: 'years', min: 1, max: 1 },
        ];
        const m = map[Math.min(a.duration, 3)] ?? map[1];
        a.durationUnit = m.unit;
        a.durationMin = m.min;
        a.durationMax = m.max;
      }
      if (a.durationUnit == null) a.durationUnit = 'months';
      if (a.durationMin == null) a.durationMin = 1;
      if (a.durationMax == null) a.durationMax = 1;
      if (!Array.isArray(a.todos)) a.todos = [];
    }
  }
  return epic;
}

export function addEpic(name, status = 'High Level Shaping') {
  const now = Date.now();
  const epic = {
    id: now,
    name: name.trim(),
    status,
    teamAssignments: [],
    annualizedEbitda: defaultEbitdaRange(),
    inYearEbitda: defaultEbitdaRange(),
    expectedDeliveryStart: defaultSprintRange(),
    valueDeliveryDate: defaultSprintRange(),
    dependencyEnvironment: 0,
    inYearEbitdaSet: false,
    valueDeliveryLinked: true,
    initiativeObjective: '',
    snapshots: [],
    metrics: [],
  };
  epics.push(epic);
  return epic;
}

function recordHistory(history, value) {
  history.push({ value, at: Date.now() });
}

export function addTeamToEpic(epicId, teamId) {
  const epic = getEpicById(epicId);
  if (!epic || epic.teamAssignments.some((a) => a.teamId === teamId)) return null;
  const assignment = {
    teamId,
    involvement: 0,
    involvementHistory: [{ value: 0, at: Date.now() }],
    durationUnit: 'months',
    durationMin: 1,
    durationMax: 1,
    notes: [],
    todos: [],
  };
  epic.teamAssignments.push(assignment);
  return assignment;
}

export function removeTeamFromEpic(epicId, teamId) {
  const epic = getEpicById(epicId);
  if (!epic) return false;
  const idx = epic.teamAssignments.findIndex((a) => a.teamId === teamId);
  if (idx === -1) return false;
  epic.teamAssignments.splice(idx, 1);
  return true;
}

export function toggleEpicMetric(epicId, metricId) {
  const epic = getEpicById(epicId);
  if (!epic) return false;
  if (!epic.metrics) epic.metrics = [];
  const idx = epic.metrics.indexOf(metricId);
  if (idx >= 0) {
    epic.metrics.splice(idx, 1);
  } else {
    epic.metrics.push(metricId);
  }
  return true;
}

export function addMetricToEpic(epicId, metricId) {
  const epic = getEpicById(epicId);
  if (!epic) return false;
  if (!epic.metrics) epic.metrics = [];
  if (epic.metrics.includes(metricId)) return true;
  epic.metrics.push(metricId);
  return true;
}

export function removeMetricFromEpic(epicId, metricId) {
  const epic = getEpicById(epicId);
  if (!epic) return false;
  if (!epic.metrics) epic.metrics = [];
  const idx = epic.metrics.indexOf(metricId);
  if (idx === -1) return false;
  epic.metrics.splice(idx, 1);
  return true;
}

export function setTeamInvolvement(epicId, teamId, value) {
  const epic = getEpicById(epicId);
  const assignment = epic?.teamAssignments.find((a) => a.teamId === teamId);
  if (!assignment) return false;
  const v = Math.max(0, Math.min(2, Math.round(Number(value))));
  assignment.involvement = v;
  recordHistory(assignment.involvementHistory, v);
  return true;
}

export function setTeamDurationRange(epicId, teamId, unit, min, max) {
  const epic = getEpicById(epicId);
  const assignment = epic?.teamAssignments.find((a) => a.teamId === teamId);
  if (!assignment) return false;
  if (!DURATION_UNITS.includes(unit)) unit = 'months';
  const rangeMax = DURATION_RANGE_MAX[unit] ?? 6;
  const mn = Math.max(1, Math.min(rangeMax, Math.round(Number(min))));
  let mx = Math.max(1, Math.min(rangeMax, Math.round(Number(max))));
  if (mn > mx) mx = mn;
  assignment.durationUnit = unit;
  assignment.durationMin = mn;
  assignment.durationMax = mx;
  return true;
}

export function setDependencyEnvironment(epicId, value) {
  const epic = getEpicById(epicId);
  if (!epic) return false;
  const v = Math.max(0, Math.min(3, Math.round(Number(value))));
  epic.dependencyEnvironment = v;
  return true;
}

export function setInitiativeObjective(epicId, text) {
  const epic = getEpicById(epicId);
  if (!epic) return false;
  epic.initiativeObjective = String(text ?? '').trim();
  return true;
}

export function addTeamNote(epicId, teamId, text) {
  const epic = getEpicById(epicId);
  const assignment = epic?.teamAssignments.find((a) => a.teamId === teamId);
  if (!assignment) return false;
  if (!assignment.notes) assignment.notes = [];
  assignment.notes.push({ text: text.trim(), at: Date.now() });
  return true;
}

export function addTeamTodo(epicId, teamId, text, risk) {
  const epic = getEpicById(epicId);
  const assignment = epic?.teamAssignments.find((a) => a.teamId === teamId);
  if (!assignment) return false;
  if (!assignment.todos) assignment.todos = [];
  const r = RISK_VALUES.includes(risk) ? risk : 'medium';
  assignment.todos.push({ text: String(text ?? '').trim(), risk: r });
  return true;
}

export function removeTeamTodo(epicId, teamId, todoIndex) {
  const epic = getEpicById(epicId);
  const assignment = epic?.teamAssignments.find((a) => a.teamId === teamId);
  if (!assignment || !Array.isArray(assignment.todos)) return false;
  const idx = Math.max(0, Math.min(todoIndex, assignment.todos.length - 1));
  assignment.todos.splice(idx, 1);
  return true;
}

function recordSprintRangeHistory(history, startSprintId, endSprintId) {
  history.push({ startSprintId, endSprintId, at: Date.now() });
}

export function setAnnualizedEbitdaRange(epicId, min, max) {
  const epic = getEpicById(epicId);
  if (!epic) return false;
  const mn = Math.max(0, Math.min(EBITDA_MAX, Math.round(Number(min))));
  const mx = Math.max(mn, Math.min(EBITDA_MAX, Math.round(Number(max))));
  epic.annualizedEbitda.min = mn;
  epic.annualizedEbitda.max = mx;
  recordHistory(epic.annualizedEbitda.minHistory, mn);
  recordHistory(epic.annualizedEbitda.maxHistory, mx);
  // In Year EBITDA sync logic removed - In Year EBITDA is no longer an input
  return true;
}

export function setInYearEbitdaRange(epicId, min, max) {
  const epic = getEpicById(epicId);
  if (!epic) return false;
  epic.inYearEbitdaSet = true;
  const annMax = epic.annualizedEbitda?.max ?? EBITDA_MAX;
  let mn = Math.max(0, Math.min(EBITDA_MAX, Math.round(Number(min))));
  let mx = Math.max(mn, Math.min(EBITDA_MAX, Math.round(Number(max))));
  mn = Math.min(mn, annMax);
  mx = Math.min(mx, annMax);
  if (mn > mx) mx = mn;
  epic.inYearEbitda.min = mn;
  epic.inYearEbitda.max = mx;
  recordHistory(epic.inYearEbitda.minHistory, mn);
  recordHistory(epic.inYearEbitda.maxHistory, mx);
  return true;
}

function snapStartSprintIfBlocked(startSprintId) {
  if (!startSprintId) return null;
  const sprint = getSprintById(startSprintId);
  if (!sprint || !sprint.isBlocked) return startSprintId;
  const sprints = getSprints();
  const idx = sprints.findIndex((s) => s.id === startSprintId);
  if (idx < 0) return startSprintId;
  const nextIdx = getNextNonBlockedIndex(idx);
  return sprints[nextIdx]?.id ?? startSprintId;
}

function enforceValueDeliveryAfterExpectedStart(epicId) {
  const epic = getEpicById(epicId);
  if (!epic) return;
  const sprints = getSprints();
  if (!sprints.length) return;
  const exp = epic.expectedDeliveryStart;
  const val = epic.valueDeliveryDate;
  const expStartId = exp?.startSprintId ?? exp?.endSprintId;
  if (!expStartId) return;
  const expStartIdx = sprints.findIndex((s) => s.id === expStartId);
  if (expStartIdx < 0) return;

  const valStartId = val?.startSprintId ?? val?.endSprintId;
  const valEndId = val?.endSprintId ?? val?.startSprintId;
  const valStartIdx = valStartId ? sprints.findIndex((s) => s.id === valStartId) : -1;
  const valEndIdx = valEndId ? sprints.findIndex((s) => s.id === valEndId) : -1;

  let newValStartId = (valStartIdx < 0 || valStartIdx < expStartIdx) ? expStartId : valStartId;
  let newValEndId = valEndId;
  if (valEndIdx < 0) {
    newValEndId = newValStartId;
  }
  // When clamping Value min to Expected min, leave Value max alone

  const changed = val?.startSprintId !== newValStartId || val?.endSprintId !== newValEndId;
  if (changed) {
    setValueDeliveryDate(epicId, newValStartId, newValEndId, true, true);
  }
}

export function setExpectedDeliveryStart(epicId, startSprintId, endSprintId) {
  const epic = getEpicById(epicId);
  if (!epic) return false;
  const snappedStart = snapStartSprintIfBlocked(startSprintId || null);
  epic.expectedDeliveryStart.startSprintId = snappedStart;
  epic.expectedDeliveryStart.endSprintId = endSprintId || null;
  recordSprintRangeHistory(epic.expectedDeliveryStart.history, epic.expectedDeliveryStart.startSprintId, epic.expectedDeliveryStart.endSprintId);
  enforceValueDeliveryAfterExpectedStart(epicId);
  return true;
}

export function setValueDeliveryDate(epicId, startSprintId, endSprintId, fromSync = false, skipEnforce = false) {
  const epic = getEpicById(epicId);
  if (!epic) return false;
  if (!fromSync) epic.valueDeliveryLinked = false;
  const snappedStart = snapStartSprintIfBlocked(startSprintId || null);
  epic.valueDeliveryDate.startSprintId = snappedStart;
  epic.valueDeliveryDate.endSprintId = endSprintId || null;
  recordSprintRangeHistory(epic.valueDeliveryDate.history, epic.valueDeliveryDate.startSprintId, epic.valueDeliveryDate.endSprintId);
  if (!skipEnforce) enforceValueDeliveryAfterExpectedStart(epicId);
  return true;
}

export function setValueDeliveryLinked(epicId, value) {
  const epic = getEpicById(epicId);
  if (!epic) return false;
  epic.valueDeliveryLinked = !!value;
  return true;
}

export function syncValueDeliveryToProjectEnd(epicId, expectedSprints) {
  const epic = getEpicById(epicId);
  if (!epic?.valueDeliveryLinked) return;
  const sprints = getSprints();
  if (!sprints.length) return;
  const exp = epic.expectedDeliveryStart;
  const expStartId = exp?.startSprintId ?? exp?.endSprintId;
  const expEndId = exp?.endSprintId ?? exp?.startSprintId;
  if (!expStartId || !expEndId) return;
  if (expectedSprints == null) {
    return;
  }
  const expEndIdx = sprints.findIndex((s) => s.id === expEndId);
  if (expEndIdx < 0) return;
  const startIdx = Math.min(expEndIdx + expectedSprints.min, sprints.length - 1);
  const endIdx = Math.min(expEndIdx + expectedSprints.max, sprints.length - 1);
  const startSprintId = sprints[startIdx]?.id ?? null;
  const endSprintId = sprints[endIdx]?.id ?? null;
  setValueDeliveryDate(epicId, startSprintId, endSprintId, true);
}

export function bootstrapEpicIfEmpty() {
  if (epics.length === 0) {
    addEpic('Bootstrap Epic');
  }
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function formatSnapshotDate(dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function captureEpicSnapshot(epicId, notes = '') {
  const epic = getEpicById(epicId);
  if (!epic) return null;
  const data = {
    name: epic.name,
    status: epic.status,
    teamAssignments: deepClone((epic.teamAssignments ?? []).map((a) => ({
      teamId: a.teamId,
      involvement: a.involvement,
      durationUnit: a.durationUnit ?? 'months',
      durationMin: a.durationMin ?? 1,
      durationMax: a.durationMax ?? 1,
      notes: (a.notes ?? []).map((n) => ({ text: n.text, at: n.at })),
      todos: (a.todos ?? []).map((t) => ({ text: t.text, risk: t.risk })),
    }))),
    annualizedEbitda: { min: epic.annualizedEbitda?.min ?? 0, max: epic.annualizedEbitda?.max ?? 0 },
    inYearEbitda: { min: epic.inYearEbitda?.min ?? 0, max: epic.inYearEbitda?.max ?? 0 },
    inYearEbitdaSet: !!epic.inYearEbitdaSet,
    expectedDeliveryStart: {
      startSprintId: epic.expectedDeliveryStart?.startSprintId ?? null,
      endSprintId: epic.expectedDeliveryStart?.endSprintId ?? null,
    },
    valueDeliveryDate: {
      startSprintId: epic.valueDeliveryDate?.startSprintId ?? null,
      endSprintId: epic.valueDeliveryDate?.endSprintId ?? null,
    },
    dependencyEnvironment: epic.dependencyEnvironment ?? 0,
    valueDeliveryLinked: !!epic.valueDeliveryLinked,
    initiativeObjective: epic.initiativeObjective ?? '',
    metrics: [...(epic.metrics ?? [])],
  };
  const version = (epic.snapshots?.length ?? 0) + 1;
  const date = formatSnapshotDate(epic.snapshots.length);
  const snapshot = { version, date, data, notes: String(notes ?? '') };
  if (!epic.snapshots) epic.snapshots = [];
  epic.snapshots.push(snapshot);
  return snapshot;
}

export function restoreEpicFromSnapshot(epicId, snapshotIndex) {
  const epic = getEpicById(epicId);
  if (!epic) return false;
  const snapshot = epic.snapshots?.[snapshotIndex];
  if (!snapshot?.data) return false;
  const d = snapshot.data;
  epic.name = d.name ?? epic.name;
  epic.status = d.status ?? epic.status;
  epic.teamAssignments = deepClone(d.teamAssignments ?? []).map((a) => ({
    ...a,
    involvementHistory: [{ value: a.involvement ?? 0, at: Date.now() }],
    durationUnit: a.durationUnit ?? 'months',
    durationMin: a.durationMin ?? 1,
    durationMax: a.durationMax ?? 1,
  }));
  const now = Date.now();
  epic.annualizedEbitda = {
    min: d.annualizedEbitda?.min ?? 0,
    max: d.annualizedEbitda?.max ?? 0,
    minHistory: [{ value: d.annualizedEbitda?.min ?? 0, at: now }],
    maxHistory: [{ value: d.annualizedEbitda?.max ?? 0, at: now }],
  };
  epic.inYearEbitda = {
    min: d.inYearEbitda?.min ?? 0,
    max: d.inYearEbitda?.max ?? 0,
    minHistory: [{ value: d.inYearEbitda?.min ?? 0, at: now }],
    maxHistory: [{ value: d.inYearEbitda?.max ?? 0, at: now }],
  };
  epic.inYearEbitdaSet = !!d.inYearEbitdaSet;
  epic.expectedDeliveryStart = {
    startSprintId: d.expectedDeliveryStart?.startSprintId ?? null,
    endSprintId: d.expectedDeliveryStart?.endSprintId ?? null,
    history: [],
  };
  epic.valueDeliveryDate = {
    startSprintId: d.valueDeliveryDate?.startSprintId ?? null,
    endSprintId: d.valueDeliveryDate?.endSprintId ?? null,
    history: [],
  };
  epic.dependencyEnvironment = d.dependencyEnvironment ?? 0;
  epic.valueDeliveryLinked = d.valueDeliveryLinked != null ? !!d.valueDeliveryLinked : true;
  epic.initiativeObjective = d.initiativeObjective ?? '';
  epic.metrics = Array.isArray(d.metrics) ? [...d.metrics] : [];
  return true;
}

export function copySnapshotToEpic(epicId, snapshotIndex) {
  const epic = getEpicById(epicId);
  if (!epic) return false;
  captureEpicSnapshot(epicId);
  return restoreEpicFromSnapshot(epicId, snapshotIndex);
}
