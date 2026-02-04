export function clampInt(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/**
 * Compute the three contiguous Project Timeline segments representing a bounding envelope.
 *
 * Inputs are sprint *indices* in the currently visible sprint list.
 *
 * Variable mapping:
 * - minStart = expectedStartMinIdx (sMin)
 * - maxStart = expectedStartMaxIdx (sMax)
 * - minDuration = expectedSprints.min (deliveryMin)
 * - maxDuration = expectedSprints.max (deliveryMax)
 * - minEnd = minStart + minDuration = sMin + deliveryMin
 * - maxEnd = maxStart + maxDuration = sMax + deliveryMax
 *
 * Three segments (all inclusive indices):
 * - Segment A: [minStart, minEnd] - Minimum execution block
 * - Segment B: [minEnd, maxStart] - Start slack / start window remainder
 * - Segment C: [maxStart, maxEnd] - Maximum execution block after latest start
 *
 * Returns null when there isn't enough data to draw.
 */
export function computeProjectTimelineSections({
  sprintCount,
  expectedStartMinIdx,
  expectedStartMaxIdx,
  expectedSprints, // {min,max} or null
  isHighConfidence = false,
}) {
  const maxIdx = Math.max(0, (sprintCount ?? 0) - 1);
  if (!Number.isFinite(maxIdx)) return null;
  if (!expectedSprints || !Number.isFinite(expectedSprints.max)) return null;

  const sMin = clampInt(expectedStartMinIdx ?? 0, 0, maxIdx);
  const sMaxRaw = expectedStartMaxIdx ?? sMin;
  const sMax = clampInt(Math.max(sMin, sMaxRaw), 0, maxIdx);

  const deliveryMin = clampInt(expectedSprints.min ?? 0, 0, maxIdx);
  const deliveryMax = clampInt(expectedSprints.max, 0, maxIdx);

  // Calculate derived points
  const minEnd = clampInt(sMin + deliveryMin, 0, maxIdx);
  const maxEnd = clampInt(sMax + deliveryMax, 0, maxIdx);

  // Segment A: Minimum execution block [minStart, minEnd]
  const segmentA = { startIdx: sMin, endIdx: minEnd };

  // Segment B: Start slack [minEnd, maxStart]
  // Clamp to ensure non-negative width (constraint: maxStart >= minEnd should always hold)
  const segmentBStart = minEnd;
  const segmentBEnd = Math.max(minEnd, sMax);
  const segmentB = { startIdx: segmentBStart, endIdx: segmentBEnd };

  // Log warning if constraint is violated (shouldn't happen logically)
  if (sMax < minEnd) {
    console.warn(`Timeline constraint violated: maxStart (${sMax}) < minEnd (${minEnd}). Segment B clamped to zero width.`);
  }

  // Segment C: Maximum execution block after latest start [maxStart, maxEnd]
  const segmentC = { startIdx: sMax, endIdx: maxEnd };

  // In high confidence mode, collapse "range-y" visuals into a single point at start.
  if (isHighConfidence) {
    // Still keep three segments, but all collapse to the start point (sMin).
    segmentA.endIdx = segmentA.startIdx;
    segmentB.startIdx = segmentB.endIdx = segmentA.startIdx;
    segmentC.startIdx = segmentC.endIdx = segmentA.startIdx;
  }

  return { 
    segmentA, 
    segmentB, 
    segmentC, 
    minEnd, 
    maxEnd, 
    maxIdx 
  };
}
