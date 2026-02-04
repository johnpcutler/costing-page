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
  removeTeamTodo,
  setAnnualizedEbitdaRange,
  setExpectedDeliveryStart,
  setValueDeliveryDate,
  setDependencyEnvironment,
  setInitiativeObjective,
  syncValueDeliveryToProjectEnd as syncValueDeliveryFromEpics,
  captureEpicSnapshot,
  restoreEpicFromSnapshot,
  copySnapshotToEpic,
  bootstrapEpicIfEmpty,
  EBITDA_MAX,
  INVOLVEMENT_LABELS,
  DURATION_UNITS,
  DURATION_UNIT_LABELS,
  DURATION_RANGE_MAX,
  DEPENDENCY_LABELS,
  RISK_LABELS,
  DEFAULT_METRICS,
  QUICK_ADD_METRIC_IDS,
  toggleEpicMetric,
  addMetricToEpic,
  removeMetricFromEpic,
} from './epics.js';
import { loadTeams, getTeamById, getTeams } from './teams.js';
import { loadSprints, getSprints, getSprintById, getNextNonBlockedIndex } from './sprints.js';
import { getDisplayValueForAnnualizedEbitda } from './confidenceMode.js';
import { computeProjectTimelineSections } from './timelineSections.js';

const METRIC_DEFINITIONS = {
  'cost-of-delay': {
    name: 'Cost of Delay',
    definition: 'Value lost per sprint if the initiative is delayed by one sprint. Used to compare "cost of waiting" across epics.',
    calculation: 'Cost of Delay ($/sprint) = Annualized EBITDA ($) ÷ 24 sprints/year',
    category: 'value'
  },
  '2026-ebitda-total': {
    name: '2026 EBITDA Total',
    definition: 'Total value attributed to the current calendar year for this epic, calculated automatically from Expected Delivery range overlap with remainder of 2026.',
    calculation: '2026 EBITDA Total = (sprints in Expected Delivery range overlapping remainder of 2026) × Cost of Delay',
    category: 'value'
  },
  'cd3-range': {
    name: 'CD3 Range',
    definition: 'Cost of Delay divided by Duration, forming a range that represents the cost efficiency of delivery.',
    calculation: 'CD3 Range min = Cost of Delay min ÷ Delivery max sprints\nCD3 Range max = Cost of Delay max ÷ Delivery min sprints',
    category: 'value'
  },
  'cd3-midpoint': {
    name: 'CD3 Midpoint',
    definition: 'Midpoint of the CD3 calculation, using the middle of the range for both Cost of Delay and Duration.',
    calculation: 'CD3 Midpoint = (Cost of Delay midpoint) ÷ (Delivery midpoint)\nWhere Cost of Delay midpoint = (Cost of Delay min + Cost of Delay max) ÷ 2\nAnd Delivery midpoint = (Delivery min + Delivery max) ÷ 2',
    category: 'value'
  },
  'cost-per-resource-per-sprint': {
    name: 'Cost Per Resource Per Sprint',
    definition: 'Blended cost per person per sprint across the teams assigned to the epic. Each team has one rate; the app shows the min and max rate across those teams.',
    calculation: 'Per team: rate = (Total Team Cost ÷ Team Size) ÷ 24 sprints/year\nResult: min(rate) and max(rate) across all assigned teams',
    category: 'cost'
  },
  'cost-per-sprint': {
    name: 'Cost Per Sprint',
    definition: 'Total spend per sprint for the epic — the sum of each team\'s burn (people × cost per person per sprint).',
    calculation: 'Per team: burn = People × Cost Per Resource Per Sprint\nMin burn = Σ (People min × Cost Per Resource Per Sprint)\nMax burn = Σ (People max × Cost Per Resource Per Sprint)\nWhere People comes from Involvement',
    category: 'cost'
  },
  'teams-resources': {
    name: 'Teams / Resources',
    definition: 'The number of teams assigned to the epic and the total range of resources (people) involved across all teams.',
    calculation: 'Teams = count of team assignments\nResources min = sum of people min across all teams (from Involvement)\nResources max = sum of people max across all teams (from Involvement)',
    category: 'cost'
  },
  'total-sprints': {
    name: 'Total Sprints',
    definition: 'Total person-sprints (people × sprints) across all teams — capacity consumed by the epic.',
    calculation: 'Per team: People × Duration (in sprints)\nTotal min = Σ (People min × Duration min)\nTotal max = Σ (People max × Duration max)\nWhere People comes from Involvement and Duration is converted to sprints',
    category: 'cost'
  },
  'expected-start': {
    name: 'Expected Start',
    definition: 'The sprint range when work on the epic is expected to start (and optionally the end of that start window).',
    calculation: 'Directly from Expected Delivery Start dates you set (start and end sprint).',
    category: 'timeline'
  },
  'expected-finish': {
    name: 'Expected Finish',
    definition: 'The calculated sprint range when work on the epic is expected to finish, based on when it starts and how long it takes.',
    calculation: 'Expected Finish min = Expected Start min + Delivery min sprints\nExpected Finish max = Expected Start max + Delivery max sprints',
    category: 'timeline'
  },
  'delivery': {
    name: 'Delivery',
    definition: 'How many sprints the work is expected to take, given team durations and how much they can work in parallel vs. in sequence.',
    calculation: 'From each team\'s Duration (converted to sprints): per team you get a min and max extent.\nParallel (longest): max of all teams\' min extents → delivery min; max of all teams\' max extents → delivery max.\nSequential (sum): sum of all teams\' min extents and sum of all teams\' max extents.\nBlend by Dependency Environment (0–3):\n  Factor f: 0 → 0, 1 → 0.15, 2 → 0.5, 3 → 1\n  Delivery min = round((1 − f) × max_min + f × sum_min)\n  Delivery max = round((1 − f) × max_max + f × sum_max)',
    category: 'timeline'
  },
  'total-cost': {
    name: 'Total Cost',
    definition: 'Total estimated cost of the epic — spend over the full delivery period.',
    calculation: 'Per team: People × Cost Per Resource Per Sprint × Duration (in sprints)\nMin total cost = Σ (People min × Cost Per Resource Per Sprint × Duration min)\nMax total cost = Σ (People max × Cost Per Resource Per Sprint × Duration max)',
    category: 'cost'
  },
  'annualized-ebitda': {
    name: 'Annualized EBITDA',
    definition: 'Expected 12-month EBITDA impact of the initiative (yearly run rate). Represents the annual value if the initiative were running for a full year.',
    calculation: 'You set a min and max (or a single value in High Confidence). Stored as slider units 0–100; each unit = $100,000, so the range is $0 to $10M.\nDollars = slider value × 100,000',
    category: 'value'
  },
  'expected-delivery-start': {
    name: 'Expected Delivery Start',
    definition: 'Sprint range when the work is expected to start (and optionally end).',
    calculation: 'You set start and end sprint directly. If you pick a blocked sprint (e.g. I&P) as start, the app snaps to the next non-blocked sprint.',
    category: 'timeline'
  },
  'value-delivery-start': {
    name: 'Value Delivery Start',
    definition: 'The sprint range when value is delivered (e.g. in market). Used to decide if value lands in the current year (for 2026 EBITDA Total).',
    calculation: 'You set start and end sprint (or leave Value linked so the app sets it from Expected Finish + delivery length). Value Delivery start is never allowed to be before Expected Start.',
    category: 'timeline'
  },
  'project-timeline': {
    name: 'Project Timeline',
    definition: 'The time band when the work runs: from Expected Delivery Start, for a length given by Delivery (sprints).',
    calculation: 'Band start = Expected Delivery Start (min)\nBand "core" end = Expected Start + Delivery min (sprints)\nBand "range" end = Expected Start + Delivery max (sprints)\nShows three sections: Start Range, Overlap, Completion Range',
    category: 'timeline'
  },
  'involvement': {
    name: 'Involvement',
    definition: 'How much of each team is on the epic: Individual (1 person), Half Team, or Full Team.',
    calculation: 'Individual (0): People min = 1, People max = 1\nHalf (1): People min = max(1, ceil(team_size/2) − 1), People max = min(team_size, ceil(team_size/2) + 1)\nFull (2): People min = team_size, People max = team_size',
    category: 'input'
  },
  'duration': {
    name: 'Duration',
    definition: 'How long each team works on the epic, in weeks, months, quarters, years, or sprints.',
    calculation: 'Conversion to sprints:\n  Weeks: ceil(weeks ÷ 2)\n  Months: months × 2\n  Quarters: quarters × 6\n  Years: years × 24\n  Sprints: no conversion\nResult is a min and max extent in sprints used in Total Sprints, Total Cost, and Delivery length.',
    category: 'input'
  },
  'dependency-environment': {
    name: 'Dependency Environment',
    definition: 'How much teams can work in parallel vs. must work in sequence. Drives the delivery-length blend.',
    calculation: 'You choose 0–3. The blend factor f is:\n  0 → 0 (fully parallel)\n  1 → 0.15 (light collaboration)\n  2 → 0.5 (high collaboration)\n  3 → 1 (fully sequential)\nThat f is used in the Delivery formulas (parallel vs. sum of team durations).',
    category: 'input'
  }
};

const epicListEl = document.getElementById('epicList');
const btnNew = document.getElementById('btnNew');
const listView = document.getElementById('listView');
const detailView = document.getElementById('detailView');
const epicDetailEl = document.getElementById('epicDetail');
const detailControlBarEl = document.getElementById('detailControlBar');
const backLink = document.getElementById('backLink');

let sprintViewRange = '2y';
let selectedSnapshotIndex = null;
let initiativeObjectiveEditingId = null;
let metricsExplanationEnabled = false;

const CONFIDENCE_MODE_KEY = 'ce-two-confidence-mode';
let confidenceMode = (() => {
  try {
    const s = localStorage.getItem(CONFIDENCE_MODE_KEY);
    return s === 'high' ? 'high' : 'ranges';
  } catch {
    return 'ranges';
  }
})();

function getVisibleSprints() {
  const all = getSprints();
  if (sprintViewRange === '1y') {
    const firstYearEnd = 27;
    return all.slice(0, Math.min(firstYearEnd, all.length));
  }
  return all;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function wirePillsScrollArrows(stripEl) {
  if (!stripEl) return;
  const scrollEl = stripEl.querySelector('.selection-pills-scroll');
  const leftBtn = stripEl.querySelector('.selection-pills-nav-left');
  const rightBtn = stripEl.querySelector('.selection-pills-nav-right');
  if (!scrollEl || !leftBtn || !rightBtn) return;

  function updateArrows() {
    const { scrollLeft, scrollWidth, clientWidth } = scrollEl;
    leftBtn.style.opacity = scrollLeft <= 0 ? '0.25' : '';
    rightBtn.style.opacity = scrollLeft >= scrollWidth - clientWidth - 1 ? '0.25' : '';
  }

  leftBtn.addEventListener('click', () => {
    scrollEl.scrollBy({ left: -150, behavior: 'smooth' });
  });
  rightBtn.addEventListener('click', () => {
    scrollEl.scrollBy({ left: 150, behavior: 'smooth' });
  });
  scrollEl.addEventListener('scroll', updateArrows);
  updateArrows();
}

function renderEpicList() {
  if (epics.length === 0) {
    epicListEl.innerHTML = `
      <li class="epic-empty">
        No program epics yet. Click "New" to create one.
      </li>
    `;
    return;
  }

  epicListEl.innerHTML = epics
    .map(
      (epic) => `
    <li class="epic-item" data-id="${epic.id}">
      <span class="epic-name">${escapeHtml(epic.name)}</span>
      <span class="epic-status">${escapeHtml(epic.status)}</span>
    </li>
  `
    )
    .join('');
}

function renderOptionPicker(label, options, selectedIndex, onSelect, readOnly = false) {
  const wrap = document.createElement('div');
  wrap.className = 'option-picker';
  const metricId = label === 'Involvement' ? 'involvement' : null;
  const labelClass = (metricId && metricsExplanationEnabled) ? 'option-picker-label metric-clickable' : 'option-picker-label';
  const labelAttr = metricId ? ` data-metric-id="${metricId}"` : '';
  wrap.innerHTML = `
    <span class="${labelClass}"${labelAttr}>${escapeHtml(label)}</span>
    <div class="option-picker-options">
      ${options.map((opt, i) => `<button type="button" class="option-btn ${i === selectedIndex ? 'selected' : ''}" data-index="${i}" ${readOnly ? 'disabled' : ''}>${escapeHtml(opt)}</button>`).join('')}
    </div>
  `;
  if (!readOnly) {
    wrap.querySelectorAll('.option-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.option-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        onSelect(Number(btn.dataset.index));
      });
    });
  }
  return wrap;
}

function formatDurationRangeLabel(unit, min, max) {
  const u = unit === 'weeks' ? 'wk' : unit === 'months' ? 'mo' : unit === 'quarters' ? 'q' : unit === 'sprints' ? 'sprint' : 'yr';
  const suffix = unit === 'sprints' ? 's' : (unit === 'weeks' || unit === 'months' || unit === 'quarters' || unit === 'years') ? 's' : 's';
  if (min === max) return `${min} ${u}${min !== 1 ? suffix : ''}`;
  return `${min}–${max} ${u}${suffix}`;
}

function renderDurationPicker(epicId, assignment, onCommit, readOnly = false, isHighConfidence = false) {
  let unit = assignment.durationUnit ?? 'months';
  let min = Math.max(1, assignment.durationMin ?? 1);
  let max = Math.max(1, assignment.durationMax ?? 1);
  const rangeMax = DURATION_RANGE_MAX[unit] ?? 6;
  if (min > rangeMax) min = rangeMax;
  if (max > rangeMax) max = rangeMax;
  if (min > max) max = min;

  const wrap = document.createElement('div');
  wrap.className = 'duration-picker';

  function render() {
    const rMax = DURATION_RANGE_MAX[unit] ?? 6;
    const fromOptions = Array.from({ length: rMax }, (_, i) => i + 1);
    const toOptions = Array.from({ length: rMax - min + 1 }, (_, i) => min + i);
    const singleVal = min;
    const singleOptions = Array.from({ length: rMax }, (_, i) => i + 1);

    if (isHighConfidence) {
      wrap.innerHTML = `
        <span class="option-picker-label ${metricsExplanationEnabled ? 'metric-clickable' : ''}" data-metric-id="duration">Extent</span>
        <div class="duration-unit-row">
          ${DURATION_UNIT_LABELS.map((lbl, i) => `<button type="button" class="option-btn ${DURATION_UNITS[i] === unit ? 'selected' : ''}" data-unit="${DURATION_UNITS[i]}" ${readOnly ? 'disabled' : ''}>${escapeHtml(lbl)}</button>`).join('')}
        </div>
        <div class="duration-range-row">
          <select class="duration-range-select duration-single" data-edge="value" ${readOnly ? 'disabled' : ''}>
            ${singleOptions.map((n) => `<option value="${n}" ${n === singleVal ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
          <span class="duration-range-unit">${unit}</span>
        </div>
      `;
    } else {
      wrap.innerHTML = `
        <span class="option-picker-label ${metricsExplanationEnabled ? 'metric-clickable' : ''}" data-metric-id="duration">Extent</span>
        <div class="duration-unit-row">
          ${DURATION_UNIT_LABELS.map((lbl, i) => `<button type="button" class="option-btn ${DURATION_UNITS[i] === unit ? 'selected' : ''}" data-unit="${DURATION_UNITS[i]}" ${readOnly ? 'disabled' : ''}>${escapeHtml(lbl)}</button>`).join('')}
        </div>
        <div class="duration-range-row">
          <select class="duration-range-select" data-edge="min" ${readOnly ? 'disabled' : ''}>
            ${fromOptions.map((n) => `<option value="${n}" ${n === min ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
          <span class="duration-range-sep">to</span>
          <select class="duration-range-select" data-edge="max" ${readOnly ? 'disabled' : ''}>
            ${toOptions.map((n) => `<option value="${n}" ${n === max ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
          <span class="duration-range-unit">${unit}</span>
        </div>
      `;
    }

    if (!readOnly) {
      wrap.querySelectorAll('[data-unit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          unit = btn.dataset.unit;
          const newRMax = DURATION_RANGE_MAX[unit] ?? 6;
          min = 1;
          max = 1;
          setTeamDurationRange(epicId, assignment.teamId, unit, min, max);
          onCommit();
        });
      });
      if (isHighConfidence) {
        wrap.querySelector('.duration-single')?.addEventListener('change', (e) => {
          const v = Number(e.target.value);
          min = v;
          max = v;
          setTeamDurationRange(epicId, assignment.teamId, unit, v, v);
          onCommit();
        });
      } else {
        wrap.querySelectorAll('.duration-range-select').forEach((sel) => {
          sel.addEventListener('change', () => {
            if (sel.dataset.edge === 'min') {
              min = Number(sel.value);
              if (max < min) max = min;
            } else {
              max = Number(sel.value);
              if (min > max) min = max;
            }
            setTeamDurationRange(epicId, assignment.teamId, unit, min, max);
            onCommit();
          });
        });
      }
    }
  }

  render();
  return wrap;
}

function openNotesModal(epicId, teamId, teamName, onAdd) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h4 class="modal-title">Notes — ${escapeHtml(teamName)}</h4>
        <button type="button" class="modal-close" aria-label="Close">×</button>
      </div>
      <div class="modal-body">
        <ul class="notes-list"></ul>
        <div class="notes-add">
          <textarea class="notes-input" placeholder="Add a note…" rows="2"></textarea>
          <button type="button" class="btn-add-note">Add Note</button>
        </div>
      </div>
    </div>
  `;

  const listEl = overlay.querySelector('.notes-list');
  const inputEl = overlay.querySelector('.notes-input');
  const addBtn = overlay.querySelector('.btn-add-note');

  function getNotes() {
    const epic = getEpicById(epicId);
    const a = epic?.teamAssignments.find((x) => x.teamId === teamId);
    return a?.notes ?? [];
  }

  function renderNotes() {
    listEl.innerHTML = getNotes().map((n) => `<li class="note-item">${escapeHtml(n.text)}</li>`).join('');
  }
  renderNotes();

  function close() {
    overlay.remove();
  }

  addBtn.addEventListener('click', () => {
    const text = inputEl.value.trim();
    if (!text) return;
    onAdd(text);
    renderNotes();
    inputEl.value = '';
  });

  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.body.appendChild(overlay);
}

const SNAPSHOT_NOTES_PLACEHOLDER = `General:

Value:

Timeline:

Collaboration:`;

function openSnapshotNotesModal(epicId, onComplete) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal-snapshot-notes">
      <div class="modal-header">
        <h4 class="modal-title">Snapshot Notes (optional)</h4>
        <button type="button" class="modal-close" aria-label="Close">×</button>
      </div>
      <div class="modal-body">
        <textarea class="snapshot-notes-input" placeholder="${escapeHtml(SNAPSHOT_NOTES_PLACEHOLDER)}" rows="8"></textarea>
        <div class="snapshot-notes-actions">
          <button type="button" class="btn-snapshot-skip">Skip</button>
          <button type="button" class="btn-snapshot-save">Save Snapshot</button>
        </div>
        <p class="snapshot-notes-hint">Use ⌘S to open a snapshot, ⌘↵ to save from this dialog.</p>
      </div>
    </div>
  `;

  const textarea = overlay.querySelector('.snapshot-notes-input');
  const skipBtn = overlay.querySelector('.btn-snapshot-skip');
  const saveBtn = overlay.querySelector('.btn-snapshot-save');

  function handleKeydown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      document.removeEventListener('keydown', handleKeydown);
      capture(textarea.value.trim());
    }
  }

  function close() {
    document.removeEventListener('keydown', handleKeydown);
    overlay.remove();
  }

  function capture(notes) {
    close();
    onComplete(notes);
  }

  skipBtn.addEventListener('click', () => capture(''));
  saveBtn.addEventListener('click', () => capture(textarea.value.trim()));
  overlay.querySelector('.modal-close').addEventListener('click', () => close());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', handleKeydown);

  document.body.appendChild(overlay);
  setTimeout(() => textarea.focus(), 0);
}

function openAddTodoModal(epicId, teamId, teamName, onAdd) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const riskOptions = RISK_LABELS.map((label, i) => {
    const val = ['low', 'medium', 'high'][i];
    return `<button type="button" class="option-btn risk-option" data-risk="${val}">${escapeHtml(label)}</button>`;
  }).join('');
  overlay.innerHTML = `
    <div class="modal modal-add-todo">
      <div class="modal-header">
        <h4 class="modal-title">Add To Do — ${escapeHtml(teamName)}</h4>
        <button type="button" class="modal-close" aria-label="Close">×</button>
      </div>
      <div class="modal-body">
        <textarea class="todo-input" placeholder="Describe the to-do…" rows="3"></textarea>
        <div class="todo-risk-row">
          <span class="todo-risk-label">Risk:</span>
          <div class="todo-risk-options">${riskOptions}</div>
        </div>
        <div class="todo-actions">
          <button type="button" class="btn-add-todo">Add</button>
        </div>
      </div>
    </div>
  `;

  const textarea = overlay.querySelector('.todo-input');
  const riskBtns = overlay.querySelectorAll('.risk-option');
  const addBtn = overlay.querySelector('.btn-add-todo');
  let selectedRisk = 'medium';

  function close() {
    overlay.remove();
  }

  riskBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      riskBtns.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedRisk = btn.dataset.risk;
    });
  });
  overlay.querySelector('.risk-option[data-risk="medium"]')?.classList.add('selected');

  addBtn.addEventListener('click', () => {
    const text = textarea.value.trim();
    if (!text) return;
    onAdd(text, selectedRisk);
    close();
  });
  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.body.appendChild(overlay);
  textarea.focus();
}

function openMetricDefinitionModal(metricId) {
  const metric = METRIC_DEFINITIONS[metricId];
  if (!metric) return;
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal-metric-definition">
      <div class="modal-header">
        <h4 class="modal-title">${escapeHtml(metric.name)}</h4>
        <button type="button" class="modal-close" aria-label="Close">×</button>
      </div>
      <div class="modal-body">
        <div class="metric-definition-section">
          <h5 class="metric-definition-label">Definition</h5>
          <p class="metric-definition-text">${escapeHtml(metric.definition)}</p>
        </div>
        <div class="metric-definition-section">
          <h5 class="metric-definition-label">Calculation</h5>
          <pre class="metric-definition-calculation">${escapeHtml(metric.calculation)}</pre>
        </div>
      </div>
    </div>
  `;
  
  function close() {
    overlay.remove();
  }
  
  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  
  document.body.appendChild(overlay);
}

function renderTeamCard(epicId, assignment, team, readOnly = false, isHighConfidence = false) {
  const teamName = team?.name ?? assignment.teamId;
  const teamSize = team?.teamSize ?? '—';
  const totalCost = team?.totalTeamCost != null ? formatCurrency(team.totalTeamCost) : '—';
  const card = document.createElement('div');
  card.className = 'team-card' + (readOnly ? ' team-card-readonly' : '');
  card.innerHTML = `
    <div class="team-card-header">
      <span class="team-card-name">${escapeHtml(teamName)}</span>
      <div class="team-card-actions">
        <button type="button" class="btn-notes" title="Notes" ${readOnly ? 'disabled' : ''}>Create Note</button>
        <button type="button" class="btn-remove" data-team-id="${assignment.teamId}" title="Remove team" ${readOnly ? 'disabled' : ''}>×</button>
      </div>
    </div>
    <div class="team-card-meta">
      <span>${teamSize} people</span>
      <span>${escapeHtml(totalCost)} total</span>
    </div>
    <div class="team-options"></div>
    <div class="team-todos">
      <div class="todo-header">
        <span>To Dos</span>
        ${!readOnly ? '<button type="button" class="btn-add-todo" title="Add To Do">Add To Do</button>' : ''}
      </div>
      <ul class="todo-list">
        ${(assignment.todos ?? []).map((t, i) => `
          <li class="todo-item" data-todo-index="${i}">
            <span class="todo-text">${escapeHtml(t.text)}</span>
            <span class="risk-badge risk-${escapeHtml(t.risk)}">${escapeHtml((t.risk || 'medium').charAt(0).toUpperCase() + (t.risk || 'medium').slice(1))}</span>
            ${!readOnly ? '<button type="button" class="btn-remove-todo" title="Remove">×</button>' : ''}
          </li>
        `).join('')}
      </ul>
    </div>
  `;

  const optionsWrap = card.querySelector('.team-options');
  optionsWrap.appendChild(
    renderOptionPicker(
      'Involvement',
      INVOLVEMENT_LABELS,
      assignment.involvement,
      (v) => {
        setTeamInvolvement(epicId, assignment.teamId, v);
        renderEpicDetail(getEpicById(epicId));
      },
      readOnly
    )
  );
  optionsWrap.appendChild(
    renderDurationPicker(epicId, assignment, () => renderEpicDetail(getEpicById(epicId)), readOnly, isHighConfidence)
  );

  card.querySelector('.btn-notes').addEventListener('click', () => {
    if (readOnly) return;
    openNotesModal(epicId, assignment.teamId, teamName, (text) => {
      addTeamNote(epicId, assignment.teamId, text);
    });
  });

  card.querySelector('.btn-remove').addEventListener('click', () => {
    if (readOnly) return;
    removeTeamFromEpic(epicId, assignment.teamId);
    renderEpicDetail(getEpicById(epicId));
  });

  card.querySelector('.btn-add-todo')?.addEventListener('click', () => {
    if (readOnly) return;
    openAddTodoModal(epicId, assignment.teamId, teamName, (text, risk) => {
      addTeamTodo(epicId, assignment.teamId, text, risk);
      renderEpicDetail(getEpicById(epicId));
    });
  });

  card.querySelectorAll('.btn-remove-todo').forEach((btn) => {
    btn.addEventListener('click', () => {
      const li = btn.closest('.todo-item');
      const idx = li ? Number(li.dataset.todoIndex) : 0;
      removeTeamTodo(epicId, assignment.teamId, idx);
      renderEpicDetail(getEpicById(epicId));
    });
  });

  return card;
}

function renderEpicDetail(epic) {
  const realEpic = getEpicById(epic.id);
  const snapshot = selectedSnapshotIndex != null && realEpic.snapshots?.[selectedSnapshotIndex]
    ? realEpic.snapshots[selectedSnapshotIndex]
    : null;
  const isSnapshotView = !!snapshot;
  const viewEpic = snapshot
    ? { id: realEpic.id, ...snapshot.data }
    : realEpic;

  const assignments = viewEpic.teamAssignments ?? [];
  const assignedIds = new Set(assignments.map((a) => a.teamId));
  const availableTeams = getTeams().filter((t) => !assignedIds.has(t.id));

  const norm = viewEpic;
  const currentYear = new Date().getFullYear();
  const dependencyEnv = norm.dependencyEnvironment ?? 0;
  const annEbitda = norm.annualizedEbitda ?? { min: 0, max: 0 };
  const annEbitdaMinDollars = ebitdaSliderToDollars(annEbitda.min);
  const annEbitdaMaxDollars = ebitdaSliderToDollars(annEbitda.max);
  const annEbitdaStr = annEbitdaMinDollars === annEbitdaMaxDollars
    ? formatCurrency(annEbitdaMinDollars)
    : `${formatCurrency(annEbitdaMinDollars)}–${formatCurrency(annEbitdaMaxDollars)}`;
  
  const costOfDelayMin = annEbitdaMinDollars / SPRINTS_PER_YEAR;
  const costOfDelayMax = annEbitdaMaxDollars / SPRINTS_PER_YEAR;
  const costOfDelayStr = costOfDelayMin === costOfDelayMax
    ? `${formatCurrency(costOfDelayMin)}/sprint`
    : `${formatCurrency(costOfDelayMin)}–${formatCurrency(costOfDelayMax)}/sprint`;

  const costPerResourcePerSprint = computeCostPerResourcePerSprint(assignments);
  const costPerSprint = computeCostPerSprint(assignments);
  const totalSprints = computeTotalSprints(assignments);
  const totalCost = computeTotalCost(assignments);
  const expectedSprints = computeExpectedSprints(assignments, dependencyEnv);

  // CD3 Range calculation: Cost of Delay / Duration
  const cd3Min = expectedSprints && expectedSprints.max > 0 
    ? costOfDelayMin / expectedSprints.max 
    : null;
  const cd3Max = expectedSprints && expectedSprints.min > 0 
    ? costOfDelayMax / expectedSprints.min 
    : null;
  const cd3RangeStr = (cd3Min != null && cd3Max != null)
    ? (cd3Min === cd3Max 
      ? formatCurrency(cd3Min)
      : `${formatCurrency(cd3Min)}–${formatCurrency(cd3Max)}`)
    : '—';

  // CD3 Midpoint calculation
  const cd3Midpoint = (expectedSprints && costOfDelayMin != null && costOfDelayMax != null)
    ? (() => {
        const codMidpoint = (costOfDelayMin + costOfDelayMax) / 2;
        const deliveryMidpoint = (expectedSprints.min + expectedSprints.max) / 2;
        return deliveryMidpoint > 0 ? codMidpoint / deliveryMidpoint : null;
      })()
    : null;
  const cd3MidpointStr = cd3Midpoint != null ? formatCurrency(cd3Midpoint) : '—';

  const costPerResourceStr = costPerResourcePerSprint ? formatRange(costPerResourcePerSprint.min, costPerResourcePerSprint.max, formatCurrency) : '—';
  const costStr = assignments.length > 0 ? formatRange(costPerSprint.min, costPerSprint.max, formatCurrency) : '—';

  // Teams / Resources calculation
  const teamsCount = assignments.length;
  let resourcesMin = 0;
  let resourcesMax = 0;
  for (const a of assignments) {
    const team = getTeamById(a.teamId);
    if (!team?.teamSize) continue;
    const { min: peopleMin, max: peopleMax } = getPeopleRangeFromInvolvement(a.involvement, team.teamSize);
    resourcesMin += peopleMin;
    resourcesMax += peopleMax;
  }
  const teamsResourcesStr = teamsCount === 0 
    ? '—'
    : teamsCount === 1
      ? `1 team, ${resourcesMin === resourcesMax ? resourcesMin : `${resourcesMin}–${resourcesMax}`} resources`
      : `${teamsCount} teams, ${resourcesMin === resourcesMax ? resourcesMin : `${resourcesMin}–${resourcesMax}`} resources`;
  
  const totalSprintStr = totalSprints ? `${formatRange(totalSprints.min, totalSprints.max, (n) => `${n}`)} total` : '—';
  const totalCostStr = totalCost ? formatRange(totalCost.min, totalCost.max, formatCurrency) : '—';
  const deliveryStr = expectedSprints
    ? (expectedSprints.min === expectedSprints.max
      ? `${expectedSprints.min} sprints`
      : `${expectedSprints.min}–${expectedSprints.max} sprints`) + ' delivery'
    : '—';

  const expDelivery = norm.expectedDeliveryStart ?? { startSprintId: null, endSprintId: null };
  const visibleSprintsForMetrics = getVisibleSprints();
  const expStartIdx = sprintIdToIndexInList(expDelivery.startSprintId, visibleSprintsForMetrics);
  const expEndIdx = sprintIdToIndexInList(expDelivery.endSprintId, visibleSprintsForMetrics);
  const expectedStartSprintStr = (expDelivery.startSprintId || expDelivery.endSprintId)
    ? formatSprintRangeFromList(expStartIdx, expEndIdx, visibleSprintsForMetrics)
    : '—';

  const expectedFinishSprintStr = (expDelivery.startSprintId || expDelivery.endSprintId) && expectedSprints
    ? calculateExpectedFinish(expStartIdx, expEndIdx, expectedSprints.min, expectedSprints.max, visibleSprintsForMetrics)
    : '—';

  const teamsSection = document.createElement('div');
  teamsSection.className = 'epic-teams-section';

  const quickAddTeams = availableTeams.slice(0, 6);
  teamsSection.innerHTML = `
    <h3 class="epic-section-title">Teams</h3>
    <div class="dependency-environment-row" id="dependencyEnvironmentRow"></div>
    <div class="selection-widget">
      <div class="selection-widget-row">
        <span class="quick-add-label">Quick Add:</span>
        <select class="selection-select" id="teamSelect" ${isSnapshotView ? 'disabled' : ''}>
          <option value="">Add a team…</option>
          ${availableTeams.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('')}
        </select>
        ${!isSnapshotView && quickAddTeams.length > 0 ? `
        <div class="selection-pills-strip">
          <button type="button" class="selection-pills-nav selection-pills-nav-left" aria-label="Scroll left">‹</button>
          <div class="selection-pills-scroll">
            <div class="selection-pills">
              ${quickAddTeams.map((t) => `<button type="button" class="selection-pill" data-team-id="${escapeHtml(t.id)}">${escapeHtml(t.name)}</button>`).join('')}
            </div>
          </div>
          <button type="button" class="selection-pills-nav selection-pills-nav-right" aria-label="Scroll right">›</button>
        </div>
        ` : ''}
      </div>
      <div class="selection-cards-wrap">
        <div class="selection-cards team-cards" id="teamCards"></div>
      </div>
    </div>
  `;

  const dependencyRow = teamsSection.querySelector('#dependencyEnvironmentRow');
  const depSelect = document.createElement('select');
  depSelect.className = 'team-select dependency-select';
  depSelect.disabled = isSnapshotView;
  depSelect.innerHTML = DEPENDENCY_LABELS.map((lbl, i) =>
    `<option value="${i}" ${i === dependencyEnv ? 'selected' : ''}>${escapeHtml(lbl)}</option>`
  ).join('');
  depSelect.addEventListener('change', () => {
    if (isSnapshotView) return;
    setDependencyEnvironment(realEpic.id, Number(depSelect.value));
    renderEpicDetail(getEpicById(realEpic.id));
  });
  const depWrap = document.createElement('div');
  depWrap.className = 'dependency-environment-wrap';
  depWrap.innerHTML = `<label class="dependency-label ${metricsExplanationEnabled ? 'metric-clickable' : ''}" data-metric-id="dependency-environment">Dependency environment</label>`;
  depWrap.appendChild(depSelect);
  dependencyRow.appendChild(depWrap);

  const cardsContainer = teamsSection.querySelector('#teamCards');
  for (const a of assignments) {
    const team = getTeamById(a.teamId);
    cardsContainer.appendChild(renderTeamCard(realEpic.id, a, team, isSnapshotView, confidenceMode === 'high'));
  }

  teamsSection.querySelector('#teamSelect')?.addEventListener('change', (e) => {
    if (isSnapshotView) return;
    const teamId = e.target.value;
    if (!teamId) return;
    addTeamToEpic(realEpic.id, teamId);
    e.target.value = '';
    renderEpicDetail(getEpicById(realEpic.id));
  });

  teamsSection.querySelectorAll('.selection-pill[data-team-id]').forEach((pill) => {
    pill.addEventListener('click', () => {
      const teamId = pill.dataset.teamId;
      if (!teamId) return;
      addTeamToEpic(realEpic.id, teamId);
      renderEpicDetail(getEpicById(realEpic.id));
    });
  });
  wirePillsScrollArrows(teamsSection.querySelector('.selection-pills-strip'));

  const valueDelivery = norm.valueDeliveryDate ?? { startSprintId: null, endSprintId: null };
  
  // Calculate 2026 Total using Expected Delivery range overlap with remainder of 2026 × Cost of Delay
  const value2026Total = calculate2026Total(expDelivery, expectedSprints, annEbitda);
  const value2026TotalStr = value2026Total
    ? (value2026Total.min === value2026Total.max
      ? formatCurrency(value2026Total.min)
      : `${formatCurrency(value2026Total.min)}–${formatCurrency(value2026Total.max)}`)
    : '—';

  const epicMetrics = viewEpic.metrics ?? [];
  const valueFinancialsSection = document.createElement('div');
  valueFinancialsSection.className = 'epic-section epic-value-financials';
  valueFinancialsSection.innerHTML = '<h3 class="epic-section-title">Value & Financials</h3>';
  valueFinancialsSection.appendChild(
    renderEbitdaBoxes(realEpic.id, annEbitda, setAnnualizedEbitdaRange, () =>
      renderEpicDetail(getEpicById(realEpic.id))
    , isSnapshotView, confidenceMode === 'high')
  );
  const quickAddMetrics = DEFAULT_METRICS.filter((m) => QUICK_ADD_METRIC_IDS.includes(m.id));
  const availableMetrics = quickAddMetrics.filter((m) => !epicMetrics.includes(m.id));
  const metricsBlock = document.createElement('div');
  metricsBlock.className = 'selection-widget';
  metricsBlock.innerHTML = `
    <div class="selection-widget-row">
      <span class="quick-add-label">Metrics to move:</span>
      <select class="selection-select" id="metricSelect" ${isSnapshotView ? 'disabled' : ''}>
        <option value="">Add a metric…</option>
        ${DEFAULT_METRICS.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.label)}</option>`).join('')}
      </select>
      ${!isSnapshotView && availableMetrics.length > 0 ? `
      <div class="selection-pills-strip">
        <button type="button" class="selection-pills-nav selection-pills-nav-left" aria-label="Scroll left">‹</button>
        <div class="selection-pills-scroll">
          <div class="selection-pills">
            ${availableMetrics.map((m) => `<button type="button" class="selection-pill" data-metric-id="${escapeHtml(m.id)}">${escapeHtml(m.label)}</button>`).join('')}
          </div>
        </div>
        <button type="button" class="selection-pills-nav selection-pills-nav-right" aria-label="Scroll right">›</button>
      </div>
      ` : ''}
    </div>
    <div class="selection-cards-wrap">
      <div class="selection-cards metrics-cards">
      ${epicMetrics.map((id) => {
        const m = DEFAULT_METRICS.find((x) => x.id === id);
        const label = m?.label ?? id;
        return `<div class="selection-card metric-card"><span class="metric-card-label">${escapeHtml(label)}</span>${!isSnapshotView ? `<button type="button" class="btn-remove-metric" data-metric-id="${escapeHtml(id)}" title="Remove">×</button>` : ''}</div>`;
      }).join('')}
      </div>
    </div>
  `;
  metricsBlock.querySelector('#metricSelect')?.addEventListener('change', (e) => {
    const metricId = e.target.value;
    if (!metricId) return;
    addMetricToEpic(realEpic.id, metricId);
    e.target.value = '';
    renderEpicDetail(getEpicById(realEpic.id));
  });
  metricsBlock.querySelectorAll('.selection-pill[data-metric-id]').forEach((pill) => {
    pill.addEventListener('click', () => {
      if (isSnapshotView) return;
      addMetricToEpic(realEpic.id, pill.dataset.metricId);
      renderEpicDetail(getEpicById(realEpic.id));
    });
  });
  metricsBlock.querySelectorAll('.btn-remove-metric').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (isSnapshotView) return;
      removeMetricFromEpic(realEpic.id, btn.dataset.metricId);
      renderEpicDetail(getEpicById(realEpic.id));
    });
  });
  wirePillsScrollArrows(metricsBlock.querySelector('.selection-pills-strip'));
  valueFinancialsSection.appendChild(metricsBlock);

  const visibleSprints = getVisibleSprints();
  const expDeliveryStartIdx = sprintIdToIndexInList(expDelivery.startSprintId, visibleSprints);
  const expDeliveryEndIdx = sprintIdToIndexInList(expDelivery.endSprintId, visibleSprints);

  const timelineSection = document.createElement('div');
  timelineSection.className = 'epic-section epic-timeline';
  timelineSection.innerHTML = '<h3 class="epic-section-title">Timeline</h3>';
  const sprintToggleRow = document.createElement('div');
  sprintToggleRow.className = 'sprint-view-toggle-row';
  sprintToggleRow.innerHTML = `
    <span class="sprint-view-toggle-label">Range</span>
    <div class="sprint-view-toggle">
      <button type="button" class="sprint-view-btn ${sprintViewRange === '1y' ? 'active' : ''}" data-range="1y">1 year</button>
      <button type="button" class="sprint-view-btn ${sprintViewRange === '2y' ? 'active' : ''}" data-range="2y">2 years</button>
    </div>
  `;
  sprintToggleRow.querySelectorAll('.sprint-view-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      sprintViewRange = btn.dataset.range;
      const hash = window.location.hash.slice(1);
      const m = hash.match(/^epic\/(\d+)$/);
      if (m) renderEpicDetail(getEpicById(m[1]));
    });
  });
  timelineSection.appendChild(sprintToggleRow);
  timelineSection.appendChild(
    renderUnifiedTimeline(
      realEpic.id,
      expDelivery,
      valueDelivery,
      expectedSprints,
      expDeliveryStartIdx,
      expDeliveryEndIdx,
      setExpectedDeliveryStart,
      setValueDeliveryDate,
      () => renderEpicDetail(getEpicById(realEpic.id)),
      isSnapshotView,
      () => renderEpicDetail(getEpicById(realEpic.id)),
      confidenceMode === 'high'
    )
  );

  epicDetailEl.innerHTML = '';
  epicDetailEl.appendChild(
    (() => {
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div class="epic-detail-header">
          <div class="epic-detail-header-top">
            <h2 class="epic-detail-title">${escapeHtml(viewEpic.name)}</h2>
            <dl class="epic-detail-meta">
              <dt>ID</dt>
              <dd>${realEpic.id}</dd>
              <dt>Status</dt>
              <dd>${escapeHtml(viewEpic.status)}</dd>
            </dl>
            <div class="initiative-objective">
              <div class="initiative-objective-label">
                <span>Initiative Objective</span>
                ${!isSnapshotView && initiativeObjectiveEditingId !== realEpic.id ? '<button type="button" class="btn-edit-objective" id="btnEditObjective" title="Edit">Edit</button>' : ''}
              </div>
              ${!isSnapshotView && initiativeObjectiveEditingId === realEpic.id
                ? `<textarea class="initiative-objective-inline" id="objectiveTextarea" placeholder="Describe the initiative objective…" rows="4">${escapeHtml((viewEpic.initiativeObjective || '').trim())}</textarea>
                   <div class="initiative-objective-actions">
                     <button type="button" class="btn-objective-cancel" id="btnObjectiveCancel">Cancel</button>
                     <button type="button" class="btn-objective-save" id="btnObjectiveSave">Save</button>
                   </div>`
                : `<div class="initiative-objective-text ${!(viewEpic.initiativeObjective || '').trim() ? 'is-placeholder' : ''}">${escapeHtml((viewEpic.initiativeObjective || '').trim()) || 'No objective set'}</div>`}
            </div>
          </div>
          <div class="epic-detail-header-metrics">
            <div class="epic-detail-header-section epic-detail-header-value">
              <h3 class="metrics-section-title">Value</h3>
              <div class="cost-summary-item cost-summary-item-highlight"><strong class="${metricsExplanationEnabled ? 'metric-clickable' : ''}" data-metric-id="annualized-ebitda">Annualized EBITDA:</strong> ${escapeHtml(annEbitdaStr)}</div>
              <div class="cost-summary-item"><strong class="${metricsExplanationEnabled ? 'metric-clickable' : ''}" data-metric-id="cost-of-delay">Cost of Delay:</strong> ${escapeHtml(costOfDelayStr)}</div>
              <div class="cost-summary-item"><strong class="${metricsExplanationEnabled ? 'metric-clickable' : ''}" data-metric-id="2026-ebitda-total">${currentYear} EBITDA Total:</strong> ${escapeHtml(value2026TotalStr)}</div>
              <div class="cost-summary-item"><strong class="${metricsExplanationEnabled ? 'metric-clickable' : ''}" data-metric-id="cd3-range">CD3 Range:</strong> ${escapeHtml(cd3RangeStr)}</div>
              <div class="cost-summary-item"><strong class="${metricsExplanationEnabled ? 'metric-clickable' : ''}" data-metric-id="cd3-midpoint">CD3 Midpoint:</strong> ${escapeHtml(cd3MidpointStr)}</div>
            </div>
            <div class="epic-detail-header-section epic-detail-header-cost">
              <h3 class="metrics-section-title">Cost</h3>
              <div class="cost-summary-item cost-summary-item-highlight"><strong class="${metricsExplanationEnabled ? 'metric-clickable' : ''}" data-metric-id="total-cost">Total Cost:</strong> ${escapeHtml(totalCostStr)}</div>
              <div class="cost-summary-item"><strong class="${metricsExplanationEnabled ? 'metric-clickable' : ''}" data-metric-id="cost-per-resource-per-sprint">Cost Per Resource Per Sprint:</strong> ${escapeHtml(costPerResourceStr)}</div>
              <div class="cost-summary-item"><strong class="${metricsExplanationEnabled ? 'metric-clickable' : ''}" data-metric-id="cost-per-sprint">Cost Per Sprint:</strong> ${escapeHtml(costStr)}</div>
            </div>
            <div class="epic-detail-header-section epic-detail-header-delivery">
              <h3 class="metrics-section-title">Delivery</h3>
              <div class="cost-summary-item cost-summary-item-highlight"><strong class="${metricsExplanationEnabled ? 'metric-clickable' : ''}" data-metric-id="delivery">Delivery:</strong> ${escapeHtml(deliveryStr)}</div>
              <div class="cost-summary-item"><strong class="${metricsExplanationEnabled ? 'metric-clickable' : ''}" data-metric-id="teams-resources">Teams / Resources:</strong> ${escapeHtml(teamsResourcesStr)}</div>
              <div class="cost-summary-item"><strong class="${metricsExplanationEnabled ? 'metric-clickable' : ''}" data-metric-id="total-sprints">Total Sprints:</strong> ${escapeHtml(totalSprintStr)}</div>
              <div class="cost-summary-item cost-summary-item-full"><strong class="${metricsExplanationEnabled ? 'metric-clickable' : ''}" data-metric-id="expected-start">Expected Start:</strong> <span class="cost-summary-value">${escapeHtml(expectedStartSprintStr)}</span></div>
              <div class="cost-summary-item cost-summary-item-full"><strong class="${metricsExplanationEnabled ? 'metric-clickable' : ''}" data-metric-id="expected-finish">Expected Finish:</strong> <span class="cost-summary-value">${escapeHtml(expectedFinishSprintStr)}</span></div>
            </div>
          </div>
        </div>
      `;
      const isHighConfidence = confidenceMode === 'high';
      detailControlBarEl.innerHTML = `
        <div class="confidence-mode-toggle">
          <button type="button" class="confidence-mode-btn ${confidenceMode === 'ranges' ? 'active' : ''}" data-mode="ranges">Confidence Ranges</button>
          <button type="button" class="confidence-mode-btn ${confidenceMode === 'high' ? 'active' : ''}" data-mode="high">High Confidence</button>
        </div>
        <button type="button" class="confidence-mode-btn ${metricsExplanationEnabled ? 'active' : ''}" id="btnMetricsExplanation">Metrics Explanation</button>
        <span class="mode-indicator ${isSnapshotView ? 'mode-viewing' : 'mode-editing'}">${isSnapshotView ? 'Viewing' : 'Editing'}</span>
        <button type="button" class="btn-snapshot" id="btnSnapshot">Snapshot ⌘S</button>
        <select class="snapshot-select" id="snapshotSelect">
          <option value="current">Current</option>
          ${(realEpic.snapshots ?? []).map((s, i) => `<option value="${i}" ${selectedSnapshotIndex === i ? 'selected' : ''}>v${s.version} – ${s.date}</option>`).join('')}
        </select>
        ${isSnapshotView ? `
          <button type="button" class="btn-snapshot-action" id="btnRevert">Revert To This Snapshot</button>
          <button type="button" class="btn-snapshot-action" id="btnCopyCurrent">Copy And Make Current</button>
        ` : ''}
      `;
      detailControlBarEl.querySelectorAll('.confidence-mode-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (btn.id === 'btnMetricsExplanation') {
            metricsExplanationEnabled = !metricsExplanationEnabled;
            renderEpicDetail(getEpicById(realEpic.id));
            return;
          }
          const mode = btn.dataset.mode;
          if (mode !== 'ranges' && mode !== 'high') return;
          confidenceMode = mode;
          try { localStorage.setItem(CONFIDENCE_MODE_KEY, mode); } catch (_) {}
          renderEpicDetail(getEpicById(realEpic.id));
        });
      });
      detailControlBarEl.querySelector('#btnSnapshot')?.addEventListener('click', () => {
        openSnapshotNotesModal(realEpic.id, (notes) => {
          captureEpicSnapshot(realEpic.id, notes);
          selectedSnapshotIndex = null;
          renderEpicDetail(getEpicById(realEpic.id));
        });
      });
      detailControlBarEl.querySelector('#snapshotSelect')?.addEventListener('change', (e) => {
        const val = e.target.value;
        selectedSnapshotIndex = val === 'current' ? null : Number(val);
        initiativeObjectiveEditingId = null;
        renderEpicDetail(getEpicById(realEpic.id));
      });
      detailControlBarEl.querySelector('#btnRevert')?.addEventListener('click', () => {
        restoreEpicFromSnapshot(realEpic.id, selectedSnapshotIndex);
        selectedSnapshotIndex = null;
        renderEpicDetail(getEpicById(realEpic.id));
      });
      detailControlBarEl.querySelector('#btnCopyCurrent')?.addEventListener('click', () => {
        copySnapshotToEpic(realEpic.id, selectedSnapshotIndex);
        selectedSnapshotIndex = null;
        renderEpicDetail(getEpicById(realEpic.id));
      });
      wrap.querySelector('#btnEditObjective')?.addEventListener('click', () => {
        initiativeObjectiveEditingId = realEpic.id;
        renderEpicDetail(getEpicById(realEpic.id));
      });
      wrap.querySelector('#btnObjectiveSave')?.addEventListener('click', () => {
        const textarea = wrap.querySelector('#objectiveTextarea');
        if (textarea) {
          setInitiativeObjective(realEpic.id, textarea.value.trim());
        }
        initiativeObjectiveEditingId = null;
        renderEpicDetail(getEpicById(realEpic.id));
      });
      wrap.querySelector('#btnObjectiveCancel')?.addEventListener('click', () => {
        initiativeObjectiveEditingId = null;
        renderEpicDetail(getEpicById(realEpic.id));
      });
      const objectiveTextarea = wrap.querySelector('#objectiveTextarea');
      if (objectiveTextarea) setTimeout(() => objectiveTextarea.focus(), 0);
      return wrap;
    })()
  );
  epicDetailEl.appendChild(valueFinancialsSection);
  epicDetailEl.appendChild(timelineSection);
  epicDetailEl.appendChild(teamsSection);
  
  // Attach click handlers for metric definitions (after all sections are appended, only if enabled)
  if (metricsExplanationEnabled) {
    epicDetailEl.querySelectorAll('.metric-clickable').forEach(el => {
      el.addEventListener('click', () => {
        const metricId = el.dataset.metricId;
        openMetricDefinitionModal(metricId);
      });
    });
  }
}

function showListView() {
  listView.classList.remove('hidden');
  detailView.classList.add('hidden');
  initiativeObjectiveEditingId = null;
  detailControlBarEl.innerHTML = '';
  renderEpicList();
}

function showDetailView(epicId) {
  const epic = getEpicById(epicId);
  if (!epic) {
    showListView();
    return;
  }
  listView.classList.add('hidden');
  detailView.classList.remove('hidden');
  selectedSnapshotIndex = null;
  renderEpicDetail(epic);
}

function handleRoute() {
  const hash = window.location.hash.slice(1);
  const match = hash.match(/^epic\/(\d+)$/);
  if (match) {
    showDetailView(match[1]);
  } else if (epics.length === 1) {
    window.location.hash = `epic/${epics[0].id}`;
  } else {
    showListView();
  }
}

// LOE methodology: 24 sprints/year, cost per resource per sprint = blended cost per head / 24
const SPRINTS_PER_YEAR = 24;

function durationToSprintRange(unit, min, max) {
  if (!unit) return { min: 1, max: 2 };
  const mn = Math.max(1, Math.round(Number(min ?? 1)));
  let mx = Math.max(1, Math.round(Number(max ?? 1)));
  if (mn > mx) mx = mn;
  let minSprints = 1;
  let maxSprints = 2;
  if (unit === 'weeks') {
    minSprints = Math.max(1, Math.ceil(mn / 2));
    maxSprints = Math.max(1, Math.ceil(mx / 2));
  } else if (unit === 'months') {
    minSprints = mn * 2;
    maxSprints = mx * 2;
  } else if (unit === 'quarters') {
    minSprints = mn * 6;
    maxSprints = mx * 6;
  } else if (unit === 'years') {
    minSprints = mn * 24;
    maxSprints = mx * 24;
  } else if (unit === 'sprints') {
    minSprints = mn;
    maxSprints = mx;
  }
  return { min: minSprints, max: maxSprints };
}

function getPeopleRangeFromInvolvement(involvementIndex, teamSize) {
  if (involvementIndex === 0) return { min: 1, max: 1 };
  if (involvementIndex === 1) {
    const half = Math.ceil(teamSize / 2);
    return { min: Math.max(1, half - 1), max: Math.min(teamSize, half + 1) };
  }
  return { min: teamSize, max: teamSize };
}

// Cost per resource per sprint = blended cost per head / 24. Range across involved teams.
function computeCostPerResourcePerSprint(assignments) {
  if (assignments.length === 0) return null;
  let minRate = Infinity;
  let maxRate = 0;
  for (const a of assignments) {
    const team = getTeamById(a.teamId);
    if (!team?.teamSize || !team?.totalTeamCost) continue;
    const rate = (team.totalTeamCost / team.teamSize) / SPRINTS_PER_YEAR;
    minRate = Math.min(minRate, rate);
    maxRate = Math.max(maxRate, rate);
  }
  return minRate === Infinity ? null : { min: minRate, max: maxRate };
}

// Cost per sprint (burn rate) = sum of (people × blended cost per head / 24) per team
function computeCostPerSprint(assignments) {
  let minTotal = 0;
  let maxTotal = 0;
  for (const a of assignments) {
    const team = getTeamById(a.teamId);
    if (!team?.teamSize || !team?.totalTeamCost) continue;
    const { min: peopleMin, max: peopleMax } = getPeopleRangeFromInvolvement(a.involvement, team.teamSize);
    const costPerPersonPerSprint = (team.totalTeamCost / team.teamSize) / SPRINTS_PER_YEAR;
    minTotal += peopleMin * costPerPersonPerSprint;
    maxTotal += peopleMax * costPerPersonPerSprint;
  }
  return { min: minTotal, max: maxTotal };
}

// Total Sprints (person-sprints) = Resources × Sprints per team, summed. Range from min/max people × min/max extent.
function computeTotalSprints(assignments) {
  if (assignments.length === 0) return null;
  let minT = 0;
  let maxT = 0;
  for (const a of assignments) {
    const team = getTeamById(a.teamId);
    if (!team?.teamSize) continue;
    const { min: peopleMin, max: peopleMax } = getPeopleRangeFromInvolvement(a.involvement, team.teamSize);
    const { min: extMin, max: extMax } = durationToSprintRange(a.durationUnit, a.durationMin, a.durationMax);
    minT += peopleMin * extMin;
    maxT += peopleMax * extMax;
  }
  return { min: minT, max: maxT };
}

// Total Cost = cost per resource per sprint × total sprints per team, summed. Range.
function computeTotalCost(assignments) {
  if (assignments.length === 0) return null;
  let minC = 0;
  let maxC = 0;
  for (const a of assignments) {
    const team = getTeamById(a.teamId);
    if (!team?.teamSize || !team?.totalTeamCost) continue;
    const { min: peopleMin, max: peopleMax } = getPeopleRangeFromInvolvement(a.involvement, team.teamSize);
    const { min: extMin, max: extMax } = durationToSprintRange(a.durationUnit, a.durationMin, a.durationMax);
    const costPerPersonPerSprint = (team.totalTeamCost / team.teamSize) / SPRINTS_PER_YEAR;
    minC += peopleMin * costPerPersonPerSprint * extMin;
    maxC += peopleMax * costPerPersonPerSprint * extMax;
  }
  return { min: minC, max: maxC };
}

// Delivery timeline: blend of parallel (longest) and sequential (sum) based on dependency
function computeExpectedSprints(assignments, dependencyEnv = 0) {
  if (assignments.length === 0) return null;
  let maxMin = 0;
  let maxMax = 0;
  let sumMin = 0;
  let sumMax = 0;
  for (const a of assignments) {
    const { min, max } = durationToSprintRange(a.durationUnit, a.durationMin, a.durationMax);
    maxMin = Math.max(maxMin, min);
    maxMax = Math.max(maxMax, max);
    sumMin += min;
    sumMax += max;
  }
  const f = dependencyEnv === 0 ? 0 : dependencyEnv === 1 ? 0.15 : dependencyEnv === 2 ? 0.5 : 1;
  const minS = Math.round((1 - f) * maxMin + f * sumMin);
  const maxS = Math.round((1 - f) * maxMax + f * sumMax);
  return { min: minS, max: maxS };
}

function formatRange(minVal, maxVal, formatter) {
  if (minVal === maxVal) return formatter(minVal);
  return `${formatter(minVal)} – ${formatter(maxVal)}`;
}

function formatMultiple(min, max) {
  if (min == null || max == null) return '—';
  if (min === max) return `${min.toFixed(1)}x`;
  return `${min.toFixed(1)}–${max.toFixed(1)}x`;
}

function calculateExpectedFinish(expStartIdx, expEndIdx, deliveryMin, deliveryMax, sprints) {
  if (expStartIdx == null || expEndIdx == null || !deliveryMin || !deliveryMax) return '—';
  const maxIdx = sprints.length - 1;
  const minFinishIdx = Math.min(expStartIdx + deliveryMin, maxIdx);
  const maxFinishIdx = Math.min(expEndIdx + deliveryMax, maxIdx);
  return formatSprintRangeFromList(minFinishIdx, maxFinishIdx, sprints);
}

function formatCurrency(value) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function ebitdaSliderToDollars(sliderVal) {
  return Math.round(sliderVal * 100000);
}

function ebitdaDollarsToSlider(dollars) {
  return Math.max(0, Math.min(EBITDA_MAX, Math.round(dollars / 100000)));
}

const EBITDA_PILLS = [
  { label: 'Average', minDollars: 0, maxDollars: 500000, widthPct: 50 },
  { label: 'Overperform', minDollars: 500000, maxDollars: 1500000, widthPct: 25 },
  { label: 'Game Changer', minDollars: 1500000, maxDollars: 5000000, widthPct: 25 },
];


function renderEbitdaBoxes(epicId, annEbitda, setAnn, onCommit, readOnly = false, isHighConfidence = false) {
  let annMin = Math.max(0, Math.min(EBITDA_MAX, annEbitda?.min ?? 0));
  let annMax = Math.max(annMin, Math.min(EBITDA_MAX, annEbitda?.max ?? 0));
  if (isHighConfidence) {
    annMax = annMin;
  }

  const annVal = isHighConfidence
    ? Math.max(0, Math.min(EBITDA_MAX, getDisplayValueForAnnualizedEbitda(annEbitda)))
    : annMin;
  const EBITDA_PILL_VALUES = { Average: 2, Overperform: 10, 'Game Changer': 32 };

  const container = document.createElement('div');
  container.className = 'ebitda-boxes';
  const disabledAttr = readOnly ? ' disabled' : '';

  container.innerHTML = `
      <div class="ebitda-box">
        <div class="ebitda-box-header">
          <div class="ebitda-box-label ${metricsExplanationEnabled ? 'metric-clickable' : ''}" data-metric-id="annualized-ebitda">Annualized EBITDA</div>
        <div class="ebitda-box-fields">
          ${isHighConfidence
            ? `<label class="ebitda-box-field"><span class="ebitda-field-label">Value</span><span class="ebitda-field-value ebitda-field-value-large" data-box="ann" data-edge="value">${escapeHtml(formatCurrency(ebitdaSliderToDollars(annVal)))}</span><div class="ebitda-field-arrows"><button type="button" class="ebitda-arrow" data-box="ann" data-edge="value" data-dir="up"${disabledAttr}>▲</button><button type="button" class="ebitda-arrow" data-box="ann" data-edge="value" data-dir="down"${disabledAttr}>▼</button></div></label>`
            : `<label class="ebitda-box-field"><span class="ebitda-field-label">Min</span><span class="ebitda-field-value ebitda-field-value-large" data-box="ann" data-edge="min">${escapeHtml(formatCurrency(ebitdaSliderToDollars(annMin)))}</span><div class="ebitda-field-arrows"><button type="button" class="ebitda-arrow" data-box="ann" data-edge="min" data-dir="up"${disabledAttr}>▲</button><button type="button" class="ebitda-arrow" data-box="ann" data-edge="min" data-dir="down"${disabledAttr}>▼</button></div></label>
               <label class="ebitda-box-field"><span class="ebitda-field-label">Max</span><span class="ebitda-field-value ebitda-field-value-large" data-box="ann" data-edge="max">${escapeHtml(formatCurrency(ebitdaSliderToDollars(annMax)))}</span><div class="ebitda-field-arrows"><button type="button" class="ebitda-arrow" data-box="ann" data-edge="max" data-dir="up"${disabledAttr}>▲</button><button type="button" class="ebitda-arrow" data-box="ann" data-edge="max" data-dir="down"${disabledAttr}>▼</button></div></label>`}
        </div>
      </div>
      <div class="ebitda-ann-pills">
        ${EBITDA_PILLS.map((p) => isHighConfidence
          ? `<button type="button" class="ebitda-pill ebitda-pill-${p.widthPct}" data-value="${EBITDA_PILL_VALUES[p.label] ?? 0}" ${readOnly ? 'disabled' : ''}>${escapeHtml(p.label)}</button>`
          : `<button type="button" class="ebitda-pill ebitda-pill-${p.widthPct}" data-min="${p.minDollars}" data-max="${p.maxDollars}" ${readOnly ? 'disabled' : ''}>${escapeHtml(p.label)}</button>`).join('')}
      </div>
    </div>
  `;

  function update(box, edge, val) {
    const valEl = container.querySelector(`.ebitda-field-value[data-box="${box}"][data-edge="${edge}"]`);
    if (valEl) valEl.textContent = formatCurrency(ebitdaSliderToDollars(val));
  }


  container.querySelectorAll('.ebitda-ann-pills .ebitda-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      if (readOnly) return;
      if (isHighConfidence) {
        const v = Number(pill.dataset.value ?? 0);
        annMin = Math.max(0, Math.min(EBITDA_MAX, v));
        annMax = annMin;
        setAnn(epicId, annMin, annMax);
        update('ann', 'value', annMin);
      } else {
        const minSlider = ebitdaDollarsToSlider(Number(pill.dataset.min));
        const maxSlider = ebitdaDollarsToSlider(Number(pill.dataset.max));
        annMin = minSlider;
        annMax = maxSlider;
        setAnn(epicId, annMin, annMax);
        update('ann', 'min', annMin);
        update('ann', 'max', annMax);
      }
      onCommit();
    });
  });
  container.querySelectorAll('.ebitda-arrow').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (readOnly) return;
      const edge = btn.dataset.edge;
      const dir = btn.dataset.dir;
      const delta = dir === 'up' ? 1 : -1;
      if (isHighConfidence) {
        annMin = Math.max(0, Math.min(EBITDA_MAX, annMin + delta));
        annMax = annMin;
        setAnn(epicId, annMin, annMax);
        update('ann', 'value', annMin);
      } else {
        if (edge === 'min') {
          annMin = Math.max(0, Math.min(EBITDA_MAX, annMin + delta));
          if (annMin > annMax) annMax = annMin;
        } else {
          annMax = Math.max(0, Math.min(EBITDA_MAX, annMax + delta));
          if (annMax < annMin) annMin = annMax;
        }
        setAnn(epicId, annMin, annMax);
        update('ann', 'min', annMin);
        update('ann', 'max', annMax);
      }
      onCommit();
    });
  });

  return container;
}

function renderCurrencyRangeStepper(epicId, _fieldKey, label, minVal, maxVal, setter) {
  let min = minVal ?? 0;
  let max = Math.max(min, maxVal ?? 0);

  const container = document.createElement('div');
  container.className = 'currency-stepper';
  container.innerHTML = `
    <span class="stepper-label">${escapeHtml(label)}</span>
    <div class="stepper-rows">
      <div class="stepper-row">
        <span class="stepper-value" data-type="min">${escapeHtml(formatCurrency(ebitdaSliderToDollars(min)))}</span>
        <div class="stepper-arrows">
          <button type="button" class="stepper-btn stepper-up" data-type="min" aria-label="Increase">▲</button>
          <button type="button" class="stepper-btn stepper-down" data-type="min" aria-label="Decrease">▼</button>
        </div>
      </div>
      <div class="stepper-row">
        <span class="stepper-value" data-type="max">${escapeHtml(formatCurrency(ebitdaSliderToDollars(max)))}</span>
        <div class="stepper-arrows">
          <button type="button" class="stepper-btn stepper-up" data-type="max" aria-label="Increase">▲</button>
          <button type="button" class="stepper-btn stepper-down" data-type="max" aria-label="Decrease">▼</button>
        </div>
      </div>
    </div>
  `;

  const minValEl = container.querySelector('.stepper-value[data-type="min"]');
  const maxValEl = container.querySelector('.stepper-value[data-type="max"]');

  function update() {
    setter(epicId, min, max);
    minValEl.textContent = formatCurrency(ebitdaSliderToDollars(min));
    maxValEl.textContent = formatCurrency(ebitdaSliderToDollars(max));
  }

  container.querySelectorAll('.stepper-up').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (type === 'min') {
        min = Math.min(EBITDA_MAX, min + 1);
        if (min > max) max = min;
      } else {
        max = Math.min(EBITDA_MAX, max + 1);
      }
      update();
    });
  });

  container.querySelectorAll('.stepper-down').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (type === 'min') {
        min = Math.max(0, min - 1);
      } else {
        max = Math.max(min, max - 1);
      }
      update();
    });
  });

  return container;
}

function sprintIdToIndex(id) {
  if (!id) return 0;
  const sprints = getSprints();
  const idx = sprints.findIndex((s) => s.id === id);
  return idx >= 0 ? idx : 0;
}

/**
 * Calculate 2026 Total based on Expected Delivery range overlap with remainder of 2026,
 * multiplied by Cost of Delay range.
 * 
 * Expected Delivery range spans from Expected Start min to Expected Start max + Delivery max.
 * We count sprints in this range that fall within remainder of 2026 (from today to end of 2026).
 * 
 * Min scenario: Expected Start min + Delivery min (earliest finish)
 * Max scenario: Expected Start max + Delivery max (latest finish)
 * 
 * 2026 Total min = (sprints in min scenario overlapping 2026) × Cost of Delay min
 * 2026 Total max = (sprints in max scenario overlapping 2026) × Cost of Delay max
 */
function calculate2026Total(expDelivery, expectedSprints, annEbitda) {
  if (!expDelivery.startSprintId || !expectedSprints) return null;
  
  const currentYear = new Date().getFullYear();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);
  
  // Get Expected Start indices
  const sprints = getSprints();
  const expStartIdx = sprintIdToIndex(expDelivery.startSprintId);
  const expEndIdx = sprintIdToIndex(expDelivery.endSprintId ?? expDelivery.startSprintId);
  
  // Min scenario: Expected Start min + Delivery min (earliest finish)
  const minEndIdx = Math.min(expStartIdx + expectedSprints.min, sprints.length - 1);
  
  // Max scenario: Expected Start max + Delivery max (latest finish)
  const maxEndIdx = Math.min(expEndIdx + expectedSprints.max, sprints.length - 1);
  
  // Count sprints in each scenario that overlap with remainder of 2026
  let overlapMinSprints = 0;
  let overlapMaxSprints = 0;
  
  // Count sprints in min scenario [Expected Start min, Expected Start min + Delivery min] that overlap remainder of 2026
  for (let i = expStartIdx; i <= minEndIdx && i < sprints.length; i++) {
    const sprint = sprints[i];
    if (!sprint) continue;
    const sprintStart = new Date(sprint.start);
    const sprintEnd = new Date(sprint.end);
    // Sprint overlaps with remainder of 2026 if it intersects with [today, yearEnd]
    if (sprintStart <= yearEnd && sprintEnd >= today) {
      overlapMinSprints++;
    }
  }
  
  // Count sprints in max scenario [Expected Start max, Expected Start max + Delivery max] that overlap remainder of 2026
  for (let i = expEndIdx; i <= maxEndIdx && i < sprints.length; i++) {
    const sprint = sprints[i];
    if (!sprint) continue;
    const sprintStart = new Date(sprint.start);
    const sprintEnd = new Date(sprint.end);
    // Sprint overlaps with remainder of 2026 if it intersects with [today, yearEnd]
    if (sprintStart <= yearEnd && sprintEnd >= today) {
      overlapMaxSprints++;
    }
  }
  
  if (overlapMinSprints === 0 && overlapMaxSprints === 0) return null;
  
  // Cost of Delay range
  const costOfDelayMin = ebitdaSliderToDollars(annEbitda.min) / SPRINTS_PER_YEAR;
  const costOfDelayMax = ebitdaSliderToDollars(annEbitda.max) / SPRINTS_PER_YEAR;
  
  // 2026 Total = overlap sprints × Cost of Delay
  const totalMin = overlapMinSprints * costOfDelayMin;
  const totalMax = overlapMaxSprints * costOfDelayMax;
  
  return { min: totalMin, max: totalMax };
}

function sprintIdToIndexInList(id, sprints) {
  if (!id || !sprints.length) return 0;
  const idx = sprints.findIndex((s) => s.id === id);
  if (idx >= 0) return idx;
  const fullIdx = sprintIdToIndex(id);
  return Math.min(fullIdx, sprints.length - 1);
}

function sprintIndexToIdInList(idx, sprints) {
  return sprints[idx]?.id ?? null;
}

function formatSprintRangeFromList(startIdx, endIdx, sprints) {
  const start = sprints[startIdx];
  const end = sprints[endIdx];
  if (!start || !end) return '—';
  const startLabel = `${start.label} (${start.start})`;
  const endLabel = `${end.label} (${end.end})`;
  return `${startLabel} — ${endLabel}`;
}

function formatSprintRangeShort(startIdx, endIdx, sprints) {
  const start = sprints[startIdx];
  const end = sprints[endIdx];
  if (!start || !end) return '—';
  if (startIdx === endIdx) return start.label;
  return `${start.label} – ${end.label}`;
}

function syncValueDeliveryToProjectEnd(epicId) {
  const epic = getEpicById(epicId);
  const expectedSprints = computeExpectedSprints(epic?.teamAssignments ?? [], epic?.dependencyEnvironment ?? 0);
  syncValueDeliveryFromEpics(epicId, expectedSprints);
}

function renderUnifiedTimeline(epicId, expDelivery, valueDelivery, expectedSprints, expDeliveryStartIdx, expDeliveryEndIdx, setExpDelivery, setValueDelivery, onCommit, readOnly = false, onCommitExpDelivery = null, isHighConfidence = false) {
  const sprints = getVisibleSprints();
  const maxIdx = Math.max(0, sprints.length - 1);
  const pct = maxIdx > 0 ? (i) => (i / maxIdx) * 100 : (i) => (i === 0 ? 100 : 0);

  const sections = computeProjectTimelineSections({
    sprintCount: sprints.length,
    expectedStartMinIdx: expDeliveryStartIdx,
    expectedStartMaxIdx: expDeliveryEndIdx,
    expectedSprints,
    isHighConfidence,
  });
  const showShade = !!sections;

  const container = document.createElement('div');
  container.className = 'timeline-unified';

  const xAxisHighlightExp = document.createElement('div');
  xAxisHighlightExp.className = 'timeline-x-axis-highlight';
  xAxisHighlightExp.style.cssText = 'left: 0%; width: 0%; opacity: 0;';

  const xAxisHighlightValue = document.createElement('div');
  xAxisHighlightValue.className = 'timeline-x-axis-highlight timeline-x-axis-highlight-value';
  xAxisHighlightValue.style.cssText = 'left: 0%; width: 0%; opacity: 0;';

  function buildSliderRow(label, startSprintId, endSprintId, setter, highlightEl, rowOnCommit = null, metricId = null) {
    const commitFn = rowOnCommit ?? onCommit;
    let startIdx = sprintIdToIndexInList(startSprintId, sprints);
    let endIdx = sprintIdToIndexInList(endSprintId, sprints);
    if (startSprintId == null && endSprintId == null) {
      startIdx = 0;
      endIdx = maxIdx;
      if (sprints[0]?.isBlocked) startIdx = Math.min(getNextNonBlockedIndex(0), maxIdx);
    }
    if (startIdx > endIdx) endIdx = startIdx;
    if (endIdx > maxIdx) endIdx = maxIdx;
    if (isHighConfidence) endIdx = startIdx;

    const disabledAttr = readOnly ? ' disabled' : '';
    const rowLabel = isHighConfidence ? label.replace(' (Min,Max)', '') : label;
    const labelClass = (metricId && metricsExplanationEnabled) ? `timeline-row-label metric-clickable` : 'timeline-row-label';
    const labelAttr = metricId ? ` data-metric-id="${escapeHtml(metricId)}"` : '';
    const row = document.createElement('div');
    row.className = 'timeline-row';
    if (isHighConfidence) {
      row.innerHTML = `
        <div class="${labelClass}"${labelAttr}>${escapeHtml(rowLabel)}</div>
        <div class="timeline-row-track">
          <div class="dual-range-wrap sprint-dual-range sprint-single-range" style="--range-min: ${pct(startIdx)}%; --range-max: ${pct(startIdx)}%;">
            <input type="range" class="slider range-single" min="0" max="${maxIdx}" step="1" value="${startIdx}"${disabledAttr} />
          </div>
          <span class="timeline-row-value">${escapeHtml(formatSprintRangeFromList(startIdx, startIdx, sprints))}</span>
        </div>
      `;
    } else {
      row.innerHTML = `
        <div class="${labelClass}"${labelAttr}>${escapeHtml(rowLabel)}</div>
        <div class="timeline-row-track">
          <div class="dual-range-wrap sprint-dual-range" style="--range-min: ${pct(startIdx)}%; --range-max: ${pct(endIdx)}%;">
            <input type="range" class="slider range-min" min="0" max="${maxIdx}" step="1" value="${startIdx}"${disabledAttr} />
            <input type="range" class="slider range-max" min="0" max="${maxIdx}" step="1" value="${endIdx}"${disabledAttr} />
            ${!readOnly ? `<div class="range-drag" style="left: ${pct(startIdx)}%; width: ${Math.max(2, pct(endIdx) - pct(startIdx))}%;"></div>` : ''}
          </div>
          <span class="timeline-row-value">${escapeHtml(formatSprintRangeFromList(startIdx, endIdx, sprints))}</span>
        </div>
      `;
    }

    const wrap = row.querySelector('.sprint-dual-range');
    const minInput = row.querySelector('.range-min');
    const maxInput = row.querySelector('.range-max');
    const singleInput = row.querySelector('.range-single');
    const rangeDragEl = wrap?.querySelector('.range-drag');
    const valueEl = row.querySelector('.timeline-row-value');

    function updateHighlight() {
      const mn = isHighConfidence ? Number(singleInput?.value ?? startIdx) : Number(minInput?.value ?? startIdx);
      const mx = isHighConfidence ? mn : Number(maxInput?.value ?? endIdx);
      const left = pct(mn);
      const w = Math.max(1, pct(mx) - left);
      highlightEl.style.left = `${left}%`;
      highlightEl.style.width = `${w}%`;
      highlightEl.style.opacity = '1';
    }

    function update() {
      if (isHighConfidence && singleInput) {
        let idx = Number(singleInput.value);
        if (sprints[idx]?.isBlocked) idx = Math.min(getNextNonBlockedIndex(idx), maxIdx);
        singleInput.value = idx;
        const sid = sprintIndexToIdInList(idx, sprints);
        setter(epicId, sid, sid);
        valueEl.textContent = formatSprintRangeFromList(idx, idx, sprints);
        wrap?.style.setProperty('--range-min', `${pct(idx)}%`);
        wrap?.style.setProperty('--range-max', `${pct(idx)}%`);
      } else if (minInput && maxInput) {
        let mn = Number(minInput.value);
        let mx = Number(maxInput.value);
        if (sprints[mn]?.isBlocked) mn = Math.min(getNextNonBlockedIndex(mn), maxIdx);
        if (mn > mx) mx = mn;
        minInput.value = mn;
        maxInput.value = mx;
        setter(epicId, sprintIndexToIdInList(mn, sprints), sprintIndexToIdInList(mx, sprints));
        valueEl.textContent = formatSprintRangeFromList(mn, mx, sprints);
        wrap?.style.setProperty('--range-min', `${pct(mn)}%`);
        wrap?.style.setProperty('--range-max', `${pct(mx)}%`);
        if (rangeDragEl) {
          rangeDragEl.style.left = `${pct(mn)}%`;
          rangeDragEl.style.width = `${Math.max(2, pct(mx) - pct(mn))}%`;
        }
      }
      updateHighlight();
    }

    if (!readOnly) {
      if (isHighConfidence && singleInput) {
        singleInput.addEventListener('input', () => { update(); });
        singleInput.addEventListener('change', commitFn);
        singleInput.addEventListener('mouseup', commitFn);
        singleInput.addEventListener('touchend', commitFn);
      } else if (minInput && maxInput) {
        minInput.addEventListener('input', () => {
          let mn = Number(minInput.value);
          if (sprints[mn]?.isBlocked) minInput.value = mn = Math.min(getNextNonBlockedIndex(mn), maxIdx);
          if (mn > Number(maxInput.value)) maxInput.value = mn;
          update();
        });
        maxInput.addEventListener('input', () => {
          if (Number(maxInput.value) < Number(minInput.value)) minInput.value = maxInput.value;
          update();
        });
        minInput.addEventListener('change', commitFn);
        maxInput.addEventListener('change', commitFn);
        [minInput, maxInput].forEach((el) => {
          el.addEventListener('mouseup', commitFn);
          el.addEventListener('touchend', commitFn);
        });

      function startRangeDrag(e) {
        e.preventDefault();
        const startPageX = e.touches ? e.touches[0].pageX : e.pageX;
        const startMn = Number(minInput.value);
        const startMx = Number(maxInput.value);
        const rangeLen = startMx - startMn;

        function onMove(e2) {
          const pageX = e2.touches ? e2.touches[0].pageX : e2.pageX;
          const deltaPx = pageX - startPageX;
          const trackWidth = wrap.offsetWidth || 1;
          const deltaIdx = (deltaPx / trackWidth) * (maxIdx + 1);
          let newMn = Math.round(startMn + deltaIdx);
          newMn = Math.max(0, Math.min(maxIdx - rangeLen, newMn));
          const newMx = newMn + rangeLen;
          minInput.value = newMn;
          maxInput.value = newMx;
          update();
        }

        function onEnd() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onEnd);
          document.removeEventListener('touchmove', onMove, { passive: true });
          document.removeEventListener('touchend', onEnd);
          rangeDragEl.classList.remove('range-dragging');
          commitFn();
        }

        rangeDragEl.classList.add('range-dragging');
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: true });
        document.addEventListener('touchend', onEnd);
      }

      if (rangeDragEl) {
        rangeDragEl.addEventListener('mousedown', startRangeDrag);
        rangeDragEl.addEventListener('touchstart', startRangeDrag, { passive: false });
      }
      }
    }

    updateHighlight();
    return row;
  }

  const rowsEl = document.createElement('div');
  rowsEl.className = 'timeline-rows';

  const expDeliveryOnCommit = onCommitExpDelivery ?? onCommit;
  rowsEl.appendChild(buildSliderRow('Expected Delivery Start (Min,Max)', expDelivery.startSprintId, expDelivery.endSprintId, setExpDelivery, xAxisHighlightExp, expDeliveryOnCommit, 'expected-delivery-start'));
  rowsEl.appendChild(buildSliderRow('Value Delivery Start (Min,Max)', valueDelivery.startSprintId, valueDelivery.endSprintId, setValueDelivery, xAxisHighlightValue, null, 'value-delivery-start'));

  const MIN_SECTION_WIDTH_PCT = 8;
  const sectionWidthPct = (startIdx, endIdx) => {
    const w = Math.max(0, pct(endIdx) - pct(startIdx));
    return w < 0.5 ? MIN_SECTION_WIDTH_PCT : w;
  };
  
  // Render Segment C (back), then Segment B (middle), then Segment A (front)
  const shadeHtml = showShade && sections
    ? (() => {
        const segA = sections.segmentA;
        const segB = sections.segmentB;
        const segC = sections.segmentC;
        
        const wA = sectionWidthPct(segA.startIdx, segA.endIdx);
        const wB = sectionWidthPct(segB.startIdx, segB.endIdx);
        const wC = sectionWidthPct(segC.startIdx, segC.endIdx);
        
        return `
          <div class="timeline-shade timeline-shade-section3" style="left: ${pct(segC.startIdx)}%; width: ${wC}%;"></div>
          <div class="timeline-shade timeline-shade-section2" style="left: ${pct(segB.startIdx)}%; width: ${wB}%;"></div>
          <div class="timeline-shade timeline-shade-section1" style="left: ${pct(segA.startIdx)}%; width: ${wA}%;"></div>
        `;
      })()
    : '<span class="timeline-row-empty">Add teams to create project timeline</span>';
  const projectRow = document.createElement('div');
  projectRow.className = 'timeline-row';
  projectRow.innerHTML = `
    <div class="timeline-row-label ${metricsExplanationEnabled ? 'metric-clickable' : ''}" data-metric-id="project-timeline">Project Timeline</div>
    <div class="timeline-row-track">
      ${shadeHtml}
    </div>
  `;
  rowsEl.appendChild(projectRow);

  const legendRow = document.createElement('div');
  legendRow.className = 'timeline-row';
  legendRow.innerHTML = `
    <div class="timeline-row-label"></div>
    <div class="timeline-row-track">
      <div class="timeline-legend">
        <div class="timeline-legend-item">
          <span class="timeline-legend-swatch timeline-legend-swatch-section1"></span>
          <span>Start Range</span>
        </div>
        <div class="timeline-legend-item">
          <span class="timeline-legend-swatch timeline-legend-swatch-section2"></span>
          <span>Overlap</span>
        </div>
        <div class="timeline-legend-item">
          <span class="timeline-legend-swatch timeline-legend-swatch-section3"></span>
          <span>Completion Range</span>
        </div>
      </div>
    </div>
  `;
  rowsEl.appendChild(legendRow);

  const xAxisRow = document.createElement('div');
  xAxisRow.className = 'timeline-row timeline-x-axis-row';
  const xAxisSpacer = document.createElement('div');
  xAxisSpacer.className = 'timeline-row-label';
  const xAxisTrack = document.createElement('div');
  xAxisTrack.className = 'timeline-x-axis-track';
  xAxisTrack.appendChild(xAxisHighlightExp);
  xAxisTrack.appendChild(xAxisHighlightValue);
  const xAxisTicks = document.createElement('div');
  xAxisTicks.className = 'timeline-x-axis-ticks';
  xAxisTicks.innerHTML = sprints.map((s) => `<span class="sprint-tick ${s.isBlocked ? 'blocked' : ''}">${escapeHtml(s.label)}</span>`).join('');
  xAxisTrack.appendChild(xAxisTicks);
  xAxisRow.appendChild(xAxisSpacer);
  xAxisRow.appendChild(xAxisTrack);

  container.appendChild(rowsEl);
  container.appendChild(xAxisRow);

  // Attach click handlers for metric definitions in timeline (only if enabled)
  if (metricsExplanationEnabled) {
    container.querySelectorAll('.metric-clickable').forEach(el => {
      el.addEventListener('click', () => {
        const metricId = el.dataset.metricId;
        openMetricDefinitionModal(metricId);
      });
    });
  }

  return container;
}

function renderSprintRangeSlider(epicId, label, startSprintId, endSprintId, setter, onCommit, expectedSprints, expDeliveryMidIdx) {
  const sprints = getVisibleSprints();
  const maxIdx = Math.max(0, sprints.length - 1);
  let startIdx = sprintIdToIndexInList(startSprintId, sprints);
  let endIdx = sprintIdToIndexInList(endSprintId, sprints);
  if (startSprintId == null && endSprintId == null) {
    startIdx = 0;
    endIdx = maxIdx;
    if (sprints[0]?.isBlocked) {
      const fullIdx = getNextNonBlockedIndex(0);
      startIdx = Math.min(fullIdx, maxIdx);
    }
  }
  if (startIdx > endIdx) endIdx = startIdx;
  if (endIdx > maxIdx) endIdx = maxIdx;

  const shadeStartIdx = (expectedSprints && expDeliveryMidIdx != null)
    ? Math.min(expDeliveryMidIdx + expectedSprints.min, maxIdx)
    : null;
  const shadeEndIdx = (expectedSprints && expDeliveryMidIdx != null)
    ? Math.min(expDeliveryMidIdx + expectedSprints.max, sprints.length - 1)
    : null;

  const pct = maxIdx > 0 ? (i) => (i / maxIdx) * 100 : (i) => (i === 0 ? 100 : 0);
  const container = document.createElement('div');
  container.className = 'sprint-range-group';
  const shadeHtml = (shadeStartIdx != null && shadeEndIdx != null && shadeStartIdx <= shadeEndIdx)
    ? `<div class="sprint-shade-band" style="left: ${pct(shadeStartIdx)}%; width: ${pct(shadeEndIdx) - pct(shadeStartIdx)}%;"></div>`
    : '';
  container.innerHTML = `
    <label class="slider-label">
      <span class="slider-label-text">${escapeHtml(label)}</span>
      <span class="slider-value sprint-range-value">${escapeHtml(formatSprintRangeFromList(startIdx, endIdx, sprints))}</span>
    </label>
    <div class="sprint-slider-track">
      <div class="sprint-ticks">
        ${sprints.map((s, i) => `<span class="sprint-tick ${s.isBlocked ? 'blocked' : ''}" data-index="${i}">${escapeHtml(s.label)}</span>`).join('')}
      </div>
      <div class="sprint-slider-wrap">
        ${shadeHtml}
        <div class="dual-range-wrap sprint-dual-range" style="--range-min: ${pct(startIdx)}%; --range-max: ${pct(endIdx)}%;">
          <input type="range" class="slider range-min" min="0" max="${maxIdx}" step="1" value="${startIdx}" />
          <input type="range" class="slider range-max" min="0" max="${maxIdx}" step="1" value="${endIdx}" />
        </div>
      </div>
    </div>
  `;

  const wrap = container.querySelector('.sprint-dual-range');
  const minInput = container.querySelector('.range-min');
  const maxInput = container.querySelector('.range-max');
  const valueEl = container.querySelector('.sprint-range-value');

  function update() {
    let mn = Number(minInput.value);
    let mx = Number(maxInput.value);
    if (sprints[mn]?.isBlocked) mn = Math.min(getNextNonBlockedIndex(mn), maxIdx);
    if (mn > mx) mx = mn;
    minInput.value = mn;
    maxInput.value = mx;
    const startId = sprintIndexToIdInList(mn, sprints);
    const endId = sprintIndexToIdInList(mx, sprints);
    setter(epicId, startId, endId);
    valueEl.textContent = formatSprintRangeFromList(mn, mx, sprints);
    wrap.style.setProperty('--range-min', `${pct(mn)}%`);
    wrap.style.setProperty('--range-max', `${pct(mx)}%`);
  }

  minInput.addEventListener('input', () => {
    let mn = Number(minInput.value);
    if (sprints[mn]?.isBlocked) {
      mn = getNextNonBlockedIndex(mn);
      minInput.value = mn;
    }
    if (mn > Number(maxInput.value)) maxInput.value = mn;
    update();
  });
  maxInput.addEventListener('input', () => {
    if (Number(maxInput.value) < Number(minInput.value)) minInput.value = maxInput.value;
    update();
  });

  if (onCommit) {
    const runCommit = () => onCommit();
    minInput.addEventListener('change', runCommit);
    maxInput.addEventListener('change', runCommit);
  }

  return container;
}

async function init() {
  bootstrapEpicIfEmpty();
  await Promise.all([loadTeams(), loadSprints()]);
  handleRoute();
}

function createNewEpic() {
  const name = prompt('Epic name:');
  if (!name?.trim()) return;

  addEpic(name);
  renderEpicList();
}

btnNew.addEventListener('click', createNewEpic);

backLink.addEventListener('click', (e) => {
  e.preventDefault();
  window.location.hash = '';
});

epicListEl.addEventListener('click', (e) => {
  const item = e.target.closest('.epic-item');
  if (!item) return;
  const id = item.dataset.id;
  if (id) window.location.hash = `epic/${id}`;
});

window.addEventListener('hashchange', handleRoute);

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    const modalOpen = document.querySelector('.modal-overlay');
    const saveBtn = modalOpen?.querySelector('.btn-snapshot-save');
    if (saveBtn) {
      saveBtn.click();
    } else if (!detailView.classList.contains('hidden')) {
      document.querySelector('#btnSnapshot')?.click();
    }
  }
});

init();
