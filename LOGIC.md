# Metrics & Logic Reference

This document describes how every metric and input in the app is defined, limited, and used in calculations. It is the single source of truth for business rules and formulas.

---

## Methodology constants

- **Sprints per year**: 24 (two-week sprints).
- **Cost per resource per sprint**: `(team total cost / team size) / 24` — i.e. blended cost per head per year ÷ 24.

---

## 1. Annualized EBITDA (12‑month value)

**What it is**: Expected annual EBITDA impact of the initiative, expressed as a yearly run-rate.

**Storage**: `epic.annualizedEbitda` with `min`, `max` (slider units 0–100), plus history arrays.

**Limits**:
- **Slider range**: 0 to `EBITDA_MAX` (100). Each unit = $100,000, so range is **$0 to $10M**.
- **Min ≤ Max**: enforced when setting; `max` is always ≥ `min`.

**How it drives other values**:
- **Cost of delay**: `annualizedEbitda / 24` (per sprint). Displayed as “Cost of Delay: $X/sprint” using `annEbitda.min` and `annEbitda.max` for the range.
- **In Year EBITDA cap**: In Year EBITDA min/max cannot exceed Annualized max (see below).
- When **In Year has not been set manually** (`inYearEbitdaSet === false`), changing Annualized min/max also updates In Year to match. Once the user sets In Year explicitly, Annualized only **clamps** In Year downward if Annualized max is reduced (In Year min/max are set to `min(inYear, annualizedMax)`).

**UI**: Confidence Ranges = min/max sliders + pills (Average / Overperform / Game Changer). High Confidence = single value (min = max).

---

## 2. In Year EBITDA (value in the current year)

**What it is**: Portion of the initiative’s value that lands in the **current calendar year** (e.g. 2026).

**Storage**: `epic.inYearEbitda` with `min`, `max` (same slider units as Annualized), plus `epic.inYearEbitdaSet` (whether the user has set it explicitly).

**Limits**:
- **Slider range**: 0 to `EBITDA_MAX` (100), same dollar mapping ($0–$10M).
- **Hard cap**: In Year min and max are **always ≤ Annualized max**. If the user tries to raise In Year above Annualized max, values are clamped and the Annualized max field flashes to indicate the cap.
- **Min ≤ Max**: enforced.

**How it’s used**:
- **“{Current Year} Total”** in the header: shown only when the Value Delivery date range overlaps the current year. Displayed as the In Year min–max range (or single value in High Confidence). If Value Delivery doesn’t overlap the current year, “—” is shown.

**Linking to Annualized**:
- If `inYearEbitdaSet === false`, In Year is kept in sync with Annualized when Annualized changes.
- If `inYearEbitdaSet === true`, only the cap applies: reducing Annualized max can reduce In Year min/max, but increasing Annualized does not auto-increase In Year.

**UI**: Pills (High % / Mixed / Mostly Next Year) set In Year relative to Annualized; arrows and direct edits are clamped to Annualized max. High Confidence shows a single In Year value, also capped by the single Annualized value.

---

## 3. Team assignment: Involvement

**What it is**: How much of each assigned team is dedicated to the epic (person-count).

**Storage**: Per assignment, `assignment.involvement` (integer 0, 1, or 2).

**Limits**: Clamped to 0–2. Labels: 0 = “Individual”, 1 = “Half Team”, 2 = “Full Team”.

**How it drives ranges**:
- **People range** (used in cost and sprint math):
  - **0 (Individual)**: min = 1, max = 1.
  - **1 (Half Team)**: min = `max(1, ceil(teamSize/2) - 1)`, max = `min(teamSize, ceil(teamSize/2) + 1)`.
  - **2 (Full Team)**: min = teamSize, max = teamSize.

So cost and delivery ranges use “people min” and “people max” from this mapping, combined with duration extent (see below).

---

## 4. Team assignment: Duration (extent)

**What it is**: How long each team works on the epic, in a chosen unit.

**Storage**: Per assignment, `durationUnit`, `durationMin`, `durationMax`. Units: `weeks`, `months`, `quarters`, `years`, `sprints`.

**Limits** (from `DURATION_RANGE_MAX`):
- weeks: 1–6  
- months: 1–6  
- quarters: 1–6  
- years: 1–3  
- sprints: 1–50  

Min/max are clamped to 1–rangeMax; min ≤ max (if min &gt; max, max is set to min).

**Conversion to sprints** (for cost and delivery math):
- weeks: `ceil(weeks / 2)` sprints  
- months: `months * 2`  
- quarters: `quarters * 6`  
- years: `years * 24`  
- sprints: unchanged  

Result is a sprint range `{ min, max }` per team used in total sprints, total cost, and expected delivery (see below).

---

## 5. Dependency environment

**What it is**: How much teams can work in parallel vs. must work in sequence.

**Storage**: `epic.dependencyEnvironment` (integer 0–3).

**Limits**: Clamped to 0–3.

**Labels** (in order):
- 0: Teams can work and deliver value independently  
- 1: Light collaboration with infrequent synchronization  
- 2: High collaboration between teams, but parallelization possible  
- 3: Phase gate, sequential coordination  

**How it drives delivery**:
- **Expected delivery length** is a blend of “fully parallel” (longest team duration) and “fully sequential” (sum of team durations):
  - Factor `f`: 0 → 0, 1 → 0.15, 2 → 0.5, 3 → 1.  
  - `expectedSprints.min = (1 - f) * maxMin + f * sumMin`  
  - `expectedSprints.max = (1 - f) * maxMax + f * sumMax`  
  (rounded). So 0 = parallel (longest), 3 = full sum; 1 and 2 are blends.

This `expectedSprints` range is used for the “Project Timeline” band and for syncing Value Delivery to project end when linked.

---

## 6. Expected Delivery Start (timeline)

**What it is**: Sprint range when the work is **expected to start** (and optionally end).

**Storage**: `epic.expectedDeliveryStart`: `startSprintId`, `endSprintId` (sprint ids from `sprints.json`).

**Limits**:
- Any sprint in the loaded list; no numeric cap beyond the list.
- **Blocked sprints**: If the user picks a blocked sprint (e.g. I&P) as start, it is snapped to the next non-blocked sprint (via `getNextNonBlockedIndex`).

**How it’s used**:
- “Expected Start” in the header (sprint range label).
- Start of the “Project Timeline” shaded band: the band runs from Expected Delivery Start (min/max indices) and extends by `expectedSprints.min` / `expectedSprints.max` (from dependency + team durations).
- **Value Delivery constraint**: Value Delivery start cannot be before Expected start. When Expected Delivery is set, `enforceValueDeliveryAfterExpectedStart` runs: if Value Delivery start is before Expected start (or unset), Value Delivery start is set to Expected start (Value end is left as-is if already valid).

---

## 7. Value Delivery Date (timeline)

**What it is**: When value is **delivered** (e.g. in market), as a sprint range.

**Storage**: `epic.valueDeliveryDate`: `startSprintId`, `endSprintId`. Also `epic.valueDeliveryLinked` (boolean).

**Limits**:
- Same as Expected Delivery (sprint list, blocked sprint snapped for start).
- **Invariant**: Value Delivery start is never before Expected Delivery start; enforcement runs after Expected or Value Delivery changes (unless that update is from sync with `skipEnforce`).

**Linking** (`valueDeliveryLinked === true`):
- When linked, “Value Delivery” can be updated automatically from Expected Delivery + expected sprint length via `syncValueDeliveryToProjectEnd(epicId, expectedSprints)`: Value start/end are set to the sprint range that is `expectedSprints.min`/`max` after the **end** of Expected Delivery. If the user edits Value Delivery manually, `valueDeliveryLinked` is set to false and auto-sync stops.

**How it’s used**:
- “{Current Year} Total” is only shown when the Value Delivery range overlaps the current calendar year; that value is In Year EBITDA (see above).
- Timeline row “Value Delivery Start (Min,Max)” and the value-delivery highlight on the x-axis.

---

## 8. Cost and delivery derived metrics

All of these are computed from team assignments (and dependency for delivery length). They do not have their own stored min/max; they are ranges derived from involvement, duration, and team cost.

**Cost per resource per sprint**  
- Per-team rate: `(totalTeamCost / teamSize) / 24`.  
- Result: min/max across assigned teams (each team has one rate).  
- Display: “Cost Per Resource Per Sprint”.

**Cost per sprint (burn rate)**  
- Per team: `people × (totalTeamCost / teamSize / 24)`; people from involvement (min or max).  
- Sum over teams: min burn = sum of (peopleMin × rate), max burn = sum of (peopleMax × rate).  
- Display: “Cost Per Sprint”.

**Total sprints (person-sprints)**  
- Per team: `peopleMin × extentMin` and `peopleMax × extentMax` (extent from duration conversion to sprints).  
- Sum over teams.  
- Display: “Total Sprints: X – Y total”.

**Total cost**  
- Per team: `people × rate × extent` (sprints).  
- Min total = sum of (peopleMin × rate × extentMin), max = sum of (peopleMax × rate × extentMax).  
- Display: “Total Cost”.

**Delivery (expected sprint length)**  
- From dependency + team durations: `computeExpectedSprints(assignments, dependencyEnv)` → `{ min, max }` sprints.  
- Display: “X sprints delivery” or “X–Y sprints delivery”.

**Expected Start**  
- Directly from `expectedDeliveryStart.startSprintId` / `endSprintId` (sprint labels).  
- Display: “Expected Start: …”.

---

## 9. Metrics to move (outcome metrics)

**What they are**: A list of outcome metric IDs (e.g. “Revenue Impact”, “NPS / Satisfaction”) that the user associates with the epic. Used for categorization and reporting, not for numeric calculations in this app.

**Storage**: `epic.metrics` — array of metric IDs from `DEFAULT_METRICS` / `QUICK_ADD_METRIC_IDS`.

**Limits**: No duplicate IDs; add/remove only. No numeric limits.

**Source of truth**: `epics.js` `DEFAULT_METRICS` and `QUICK_ADD_METRIC_IDS` define the available options.

---

## 10. Confidence modes (UI only)

**Confidence Ranges**: All value and timeline inputs show min/max (sliders, ranges). Calculations use the stored min/max.

**High Confidence**: UI shows a single value per input. Stored data remains min/max; display uses:
- **Annualized EBITDA**: `annEbitda.min` (display value).
- **In Year EBITDA**: `min(inYearEbitda.min, annEbitda.min)` (capped for display).
- **Timeline**: `startSprintId` (or `endSprintId` if start null) for each range.
- **Duration**: `durationMin` per team.

So in High Confidence, the same formulas and caps apply; only the displayed and editable “single value” is derived from the existing min/max as above.

---

## 11. EBITDA display conversion

- **Slider → dollars**: `sliderValue * 100000` ($100k per unit; max 100 → $10M).  
- **Dollars → slider**: `round(dollars / 100000)` clamped to 0–EBITDA_MAX.

Pills (Average / Overperform / Game Changer) map to dollar ranges, then to slider min/max when applied.

---

## 12. Summary: constraints and dependencies

| Input / metric            | Hard limits                         | Drives / constrained by                                      |
|---------------------------|-------------------------------------|--------------------------------------------------------------|
| Annualized EBITDA         | 0–100 ($0–$10M), min ≤ max          | Cost of delay; caps In Year; can sync or clamp In Year      |
| In Year EBITDA            | 0–100, ≤ Annualized max, min ≤ max  | Current year total (if Value Delivery in year)              |
| Involvement               | 0, 1, or 2                         | People range → cost and delivery ranges                     |
| Duration (per team)        | 1–rangeMax by unit, min ≤ max       | Sprint extent → total sprints, total cost, expected length  |
| Dependency environment    | 0–3                                 | Blend factor for expected delivery length                   |
| Expected Delivery Start   | Sprint list, no start on blocked   | Timeline band; Value Delivery start ≥ this                  |
| Value Delivery Date       | Sprint list; start ≥ Expected start| Current year total (with In Year); can be synced when linked |
| Team (from teams.json)    | teamSize, totalTeamCost            | Rate and people for all cost/delivery math                  |

No other hidden caps or formulas apply; all behavior is defined by the code paths and constants referenced in this document.
