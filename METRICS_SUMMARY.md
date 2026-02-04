# Metric Summary — Definitions and Calculations

Each metric shown in the Program Epics app, with a short definition and how it is calculated.

---

## Value metrics (inputs and derived)

### Annualized EBITDA

**Definition:** Expected **12‑month** EBITDA impact of the initiative (yearly run rate). Represents the annual value if the initiative were running for a full year.

**Calculation:** You set a **min** and **max** (or a single value in High Confidence). Stored as slider units 0–100; each unit = **$100,000**, so the range is **$0 to $10M**.  
- Dollars = **slider value × 100,000**.

---

### In Year EBITDA

**Definition:** Portion of the initiative’s value that lands in the **current calendar year** (e.g. 2026). Used when value delivery overlaps that year.

**Calculation:** You set min and max (or a single value in High Confidence). Same scale as Annualized: 0–100 → $0–$10M.  
- **Constraint:** In Year min and max cannot exceed Annualized max; the app clamps and flashes the annualized cap if you try to go above it.  
- If you have not set In Year yourself, it follows Annualized when you change Annualized; once set, it only moves down when you lower Annualized max.

---

### Cost of Delay

**Definition:** Value lost **per sprint** if the initiative is delayed by one sprint. Used to compare “cost of waiting” across epics.

**Calculation:**  
- **Cost of delay ($/sprint) = Annualized EBITDA ($) ÷ 24**  
- Uses Annualized min and max, so you see a range (e.g. $X–$Y/sprint) or a single value.  
- Formula: `annualized_dollars / 24` (24 sprints per year).

---

### {Current Year} Total (e.g. 2026 Total)

**Definition:** Total value attributed to the **current calendar year** for this epic. Only meaningful when value is actually delivered in that year.

**Calculation:**  
- **Value used:** In Year EBITDA min and max, converted to dollars (slider × $100,000).  
- **When it’s shown:** Only when the **Value Delivery** date range overlaps the current year. Overlap = (year of Value Delivery start) ≤ current year ≤ (year of Value Delivery end).  
- If there is no Value Delivery or no overlap, the header shows **"—"**.  
- Formula: **In Year EBITDA (min and max) in dollars**, displayed only when Value Delivery overlaps current year.

---

## Cost and capacity metrics (derived from teams)

**Methodology:** 24 sprints per year. Cost per resource per sprint = (team total cost ÷ team size) ÷ 24.

---

### Cost Per Resource Per Sprint

**Definition:** Blended **cost per person per sprint** across the teams assigned to the epic. Each team has one rate; the app shows the min and max rate across those teams.

**Calculation:**  
- Per team: **rate = (total team cost ÷ team size) ÷ 24**.  
- Result: **min(rate)** and **max(rate)** across all assigned teams.  
- Units: $/sprint per person.

---

### Cost Per Sprint (burn rate)

**Definition:** Total **spend per sprint** for the epic — the sum of each team’s burn (people × cost per person per sprint).

**Calculation:**  
- Per team: **burn = people × (total team cost ÷ team size ÷ 24)**. “People” comes from the team’s **Involvement** (Individual = 1, Half = about half the team, Full = full team size).  
- **Min burn** = sum over teams of (people_min × rate).  
- **Max burn** = sum over teams of (people_max × rate).  
- Formula: **Σ (people × rate)** per team, with min/max from involvement ranges.

---

### Total Sprints (person-sprints)

**Definition:** Total **person-sprints** (people × sprints) across all teams — capacity consumed by the epic.

**Calculation:**  
- Per team: **people_min × extent_min** and **people_max × extent_max**. “Extent” is the team’s duration converted to sprints (see Duration below).  
- **Total min** = Σ (people_min × extent_min).  
- **Total max** = Σ (people_max × extent_max).  
- Formula: **Σ (people × extent in sprints)** per team, using min/max people and min/max extent.

---

### Total Cost

**Definition:** **Total estimated cost** of the epic — spend over the full delivery period.

**Calculation:**  
- Per team: **people × rate × extent** (sprints).  
- **Min total cost** = Σ (people_min × rate × extent_min).  
- **Max total cost** = Σ (people_max × rate × extent_max).  
- Formula: **Σ (people × cost per person per sprint × extent in sprints)** per team.

---

### Delivery (expected sprint length)

**Definition:** How many **sprints** the work is expected to take, given team durations and how much they can work in parallel vs. in sequence.

**Calculation:**  
- From each team’s **duration** (converted to sprints): per team you get a min and max extent in sprints.  
- **Parallel (longest):** max of all teams’ min extents → delivery min; max of all teams’ max extents → delivery max.  
- **Sequential (sum):** sum of all teams’ min extents and sum of all teams’ max extents.  
- **Blend** by **Dependency environment** (0–3):  
  - **Factor f:** 0 → 0, 1 → 0.15, 2 → 0.5, 3 → 1.  
  - **Delivery min** = round((1 − f) × max_min + f × sum_min).  
  - **Delivery max** = round((1 − f) × max_max + f × sum_max).  
- So: 0 = fully parallel (longest team), 3 = fully sequential (sum of teams); 1 and 2 are blends.

---

## Timeline metrics

### Expected Start

**Definition:** The **sprint range** when work on the epic is expected to **start** (and optionally the end of that start window).

**Calculation:** Directly from the **Expected Delivery Start** dates you set (start and end sprint). Displayed as sprint labels (e.g. “S1 – S6”). If you pick a blocked sprint (e.g. I&P) as start, the app snaps to the next non-blocked sprint.

---

### Value Delivery Start (timeline)

**Definition:** The **sprint range** when **value is delivered** (e.g. in market). Used to decide if value lands in the current year (for {Year} Total).

**Calculation:** You set start and end sprint (or leave **Value linked** so the app sets it from Expected end + delivery length). Value Delivery start is never allowed to be before Expected start; the app enforces that when you change either range.

---

### Project Timeline (band)

**Definition:** The **time band** when the work runs: from Expected Delivery Start, for a length given by **Delivery** (sprints).

**Calculation:**  
- **Band start** = Expected Delivery Start (min).  
- **Band “core” end** = Expected Start + Delivery min (sprints).  
- **Band “range” end** = Expected Start + Delivery max (sprints).  
- So the band shows when work starts and the min/max range of when it finishes.

---

## Inputs that drive the metrics (not displayed as standalone metrics)

### Involvement (per team)

**Definition:** How much of each team is on the epic: **Individual** (1 person), **Half Team**, or **Full Team**.

**Calculation of “people” for cost/sprint math:**  
- **Individual (0):** people_min = 1, people_max = 1.  
- **Half (1):** people_min = max(1, ceil(team_size/2) − 1), people_max = min(team_size, ceil(team_size/2) + 1).  
- **Full (2):** people_min = team_size, people_max = team_size.

---

### Duration / Extent (per team)

**Definition:** How long each team works on the epic, in weeks, months, quarters, years, or sprints.

**Calculation (conversion to sprints):**  
- **Weeks:** ceil(weeks ÷ 2).  
- **Months:** months × 2.  
- **Quarters:** quarters × 6.  
- **Years:** years × 24.  
- **Sprints:** no conversion.  
- Result is a **min** and **max** extent in sprints used in total sprints, total cost, and delivery length.

---

### Dependency environment

**Definition:** How much teams can work **in parallel** vs. must work **in sequence**. Drives the delivery-length blend.

**Calculation:** You choose 0–3. The **blend factor f** is: 0 → 0, 1 → 0.15, 2 → 0.5, 3 → 1. That f is used in the Delivery formulas above (parallel vs. sum of team durations).

---

## Metrics to move (outcome metrics)

**Definition:** Labels you attach to the epic (e.g. “Revenue Impact”, “NPS / Satisfaction”) for categorization and reporting.

**Calculation:** No calculation. You add or remove metric IDs from a fixed list; they do not affect any numeric metrics in the app.
