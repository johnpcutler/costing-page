// Display-value helpers for High Confidence mode.
// When switching from Ranges to High Confidence, these compute the single value to show.

/** Returns the value to display for Annualized EBITDA when switching to High Confidence */
export function getDisplayValueForAnnualizedEbitda(annEbitda) {
  return annEbitda?.min ?? 0;
}

/** In Year is capped by Annualized; display uses min of inYear.min and ann.min */
export function getDisplayValueForInYearEbitda(inYearEbitda, annEbitda) {
  const inMin = inYearEbitda?.min ?? 0;
  const annMin = annEbitda?.min ?? 0;
  return Math.min(inMin, annMin);
}

/** Timeline: use startSprintId (or endSprintId if start null) */
export function getDisplayValueForSprintRange(range) {
  return range?.startSprintId ?? range?.endSprintId ?? null;
}

/** Duration: use durationMin */
export function getDisplayValueForDuration(assignment) {
  return assignment?.durationMin ?? 1;
}
