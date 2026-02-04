# Program Epics — User Guide

This guide explains how to use the app from the browser: what you see, how to move around, and how to capture cost and value for program epics.

---

## What the app does

You use this app to shape **program epics**: initiatives that involve one or more teams, have an expected cost and timeline, and an expected value (EBITDA). For each epic you can:

- Add teams and set how much of each team is involved and for how long
- Set expected value (annualized) and see cost of delay
- Set when work is expected to start and when value will be delivered
- Attach outcome metrics and notes, and save snapshots to compare versions

The app computes cost per sprint, total cost, and delivery length from your team and timeline inputs.

---

## Opening the app

Open the app in your browser (e.g. by opening `index.html` or the URL your team uses). You’ll start on the **Program Epics** list.

---

## List view (home)

**What you see**

- **Header**: “Program Epics” and a **+ New** button
- **Table**: Columns **Epic** (name) and **Status**
- If there are no epics: “No program epics yet. Click ‘New’ to create one.”

**What you can do**

- **Create an epic**: Click **+ New**. A prompt asks for the epic name; enter a name and confirm. The new epic appears in the list.
- **Open an epic**: Click a row. The URL changes to `#epic/123` (the number is the epic ID) and the epic detail view opens.

---

## Epic detail view

When you open an epic, you see:

1. **Header**: **← Back** (returns to the list), then a control bar
2. **Epic title and meta**: Name, ID, Status
3. **Initiative Objective**: Short description of the initiative (editable)
4. **Summary metrics**: Cost of Delay, current-year total value, cost per resource/sprint, cost per sprint, total resource sprints, expected start, delivery length, total cost
5. **Value & Financials**: Annualized EBITDA and Metrics to move
6. **Timeline**: Expected Delivery Start, Value Delivery Start, and Project Timeline
7. **Teams**: Dependency environment, team cards with involvement and extent, notes, and to-dos

Below is what each part does and how to use it.

---

## Control bar (top of detail)

**Confidence Ranges / High Confidence**

- **Confidence Ranges**: You work with min and max (ranges) for value and timelines. Best when you’re still estimating.
- **High Confidence**: You work with a single value per field. Best when you have a firm estimate. Your choice is remembered for the next time you open the app.

**Viewing / Editing**

- **Editing**: You’re on the live epic; all changes save as you go.
- **Viewing**: You’re looking at a snapshot (past version). You can’t edit; use **Revert** or **Copy And Make Current** to act on that version.

**Snapshot**

- **Snapshot ⌘S**: Saves a snapshot of the epic now. You can add optional notes (e.g. “Pre–Q2 review”). Shortcut: **⌘S** (Mac) or **Ctrl+S** to open the snapshot dialog; **⌘↵** or **Ctrl+Enter** in the dialog to save.
- **Snapshot dropdown**: “Current” or “v1 – …”, “v2 – …”, etc. Switch to a past snapshot to compare. The page shows that version (view-only) and the bar shows **Viewing**.
- **Revert To This Snapshot**: Replaces the current epic with the snapshot you’re viewing. You then edit the reverted version.
- **Copy And Make Current**: Copies the snapshot’s data into the current epic and leaves you editing that. Useful to try a variant without losing the current state.

---

## Initiative Objective

A short description of what the initiative is for.

- **Edit**: Click **Edit** next to “Initiative Objective”, type in the text area, then **Save** or **Cancel**.
- If nothing is set, it shows “No objective set”.

---

## Summary metrics (header)

These are computed from your inputs; you don’t edit them here.

| Metric | Meaning |
|--------|--------|
| **Cost of Delay** | Value lost per sprint of delay (annualized value ÷ 24). Shown as $X/sprint or a range. |
| **{Year} Total** | In-year value for the current calendar year, only when Value Delivery overlaps that year. Otherwise “—”. |
| **Cost Per Resource Per Sprint** | Blended cost per person per sprint across the assigned teams. |
| **Cost Per Sprint** | Total burn rate (sum of team costs at the involvement level you set). |
| **Total Resource Sprints** | Sum of person-sprints across teams (people × duration). |
| **Expected Start** | The sprint range you set for when work starts. |
| **Delivery** | How many sprints the work takes (based on team durations and dependency). |
| **Total Cost** | Estimated total cost (cost per sprint × delivery, in range form). |

---

## Value & Financials

**Annualized EBITDA**

- Expected **12‑month** value (run rate) of the initiative.
- **Confidence Ranges**: You set **Min** and **Max** (arrows or pills: Average / Overperform / Game Changer). Values are in dollars; the app converts to an internal scale ($0–$10M).
- **High Confidence**: Single **Value** and the same pills to set a point estimate.
- This drives **Cost of Delay** and the **2026 Total** calculation.

**In Year EBITDA**

- Value that lands in the **current calendar year**.
- **Confidence Ranges**: Min and Max; pills: **High %**, **Mixed**, **Mostly Next Year** set it relative to annualized.
- **High Confidence**: Single value.
- **Limit**: In Year can never be set above Annualized. If you try (e.g. arrow up when already at the cap), the annualized value flashes red to show the cap.
- If you haven’t set In Year yourself, it follows Annualized when you change Annualized. Once you set it (pills or arrows), it only follows downward when you lower Annualized max.

**Metrics to move**

- Outcome metrics you care about for this epic (e.g. Revenue Impact, NPS, Retention).
- **Add**: Use the **Add a metric…** dropdown or click a pill (e.g. Revenue Impact, NPS / Satisfaction). You can scroll the pills with the arrows if there are many.
- **Remove**: Click the **×** on a metric card.
- These are labels for the epic; they don’t change any numbers in the app.

---

## Timeline

**Range**

- **1 year** / **2 years**: Chooses how much of the roadmap is visible on the timeline. Doesn’t change data, only the visible window.

**Expected Delivery Start (Min, Max)**

- When you expect the work to **start** (and optionally the end of the start window). Drag the sliders or the range between them. The bar under the timeline shows this range.
- If you pick a blocked sprint (e.g. I&P) as start, the app will snap to the next available sprint.

**Value Delivery Start (Min, Max)**

- When **value is delivered** (e.g. in market). Same interaction as Expected Delivery.
- Value Delivery start is never allowed to be before Expected start; if you move Expected start later, Value start can be adjusted automatically to stay valid.

**Project Timeline**

- The shaded band shows when the work runs: from Expected Delivery Start, for the length given by **Delivery** (which depends on teams and dependency). If there are no teams yet, it shows “Add teams to create project timeline”.

---

## Teams

**Dependency environment**

- A dropdown describing how much teams depend on each other:
  - Teams can work and deliver value independently
  - Light collaboration with infrequent synchronization
  - High collaboration, but parallelization possible
  - Phase gate, sequential coordination  
- This changes how **Delivery** is calculated (more dependency → longer delivery).

**Adding teams**

- **Dropdown**: “Add a team…” — pick a team to add.
- **Pills**: Click a team name in the Quick Add pills (scroll with ‹ › if needed). The team is added and a card appears below.

**Team card (per team)**

- **Header**: Team name, **Create Note**, **×** (remove team).
- **Meta**: Team size (people) and total team cost (from your data).
- **Involvement**: **Individual** (1 person), **Half Team**, **Full Team**. This sets how many people from that team work on the epic and feeds into cost and delivery.
- **Extent**: How long that team is on the epic. Choose unit (Weeks, Months, Quarters, Years, Sprints) and a value or range (e.g. “2 to 4 months”). In High Confidence you set a single extent.
- **To Dos**: List of to-dos for this team. **Add To Do** opens a small dialog: describe the to-do, pick **Risk** (Low / Medium / High), then **Add**. Use **×** on a to-do to remove it.
- **Notes**: **Create Note** opens a notes modal. Add notes; they’re listed and stay with this team on this epic.

**Removing a team**

- Click **×** on the team card. The team is removed and all cost/delivery numbers update.

---

## Snapshots in practice

1. **Save a baseline**: Before a big change, click **Snapshot ⌘S**, add a note like “Before Q2 scope change”, and save. Choose “Current” in the dropdown to keep editing.
2. **Compare**: Use the snapshot dropdown to switch to “v1 – …” (or another version). The page shows that version in read-only mode (**Viewing**).
3. **Revert**: If you prefer the old version, click **Revert To This Snapshot**. The current epic is replaced by that snapshot; you’re back in **Editing**.
4. **Branch**: To try a different direction without losing the current one, open a snapshot, then **Copy And Make Current**. You now edit a copy of that snapshot as the current epic.

---

## Keyboard shortcuts

- **⌘S** / **Ctrl+S**: From the epic detail, opens the Snapshot dialog (or saves from the dialog if it’s open).
- **⌘↵** / **Ctrl+Enter**: In the Snapshot notes dialog, saves the snapshot (same as **Save Snapshot**).

---

## Tips

- **Cost of delay**: If you increase annualized value, cost of delay goes up. Use it to compare “how much we lose per sprint” across epics.
- **In Year vs Annualized**: Set Annualized first; then set In Year (or use the pills). In Year can’t exceed Annualized; the red flash reminds you when you hit the cap.
- **Delivery length**: Add teams and set extent; then adjust **Dependency environment** to see how parallel vs sequential changes the delivery length and the Project Timeline band.
- **Timeline**: Set **Expected Delivery Start** first; then set **Value Delivery Start** so it’s on or after when work starts. Use **1 year** / **2 years** to zoom the timeline.
- **Confidence**: Use **Confidence Ranges** while estimating; switch to **High Confidence** when you’re committing to a single plan.

---

## Getting back to the list

Click **← Back** at the top of the epic detail. You return to the Program Epics list. The list reflects the latest names and statuses; all epic data is kept in the app until you clear or replace it.
