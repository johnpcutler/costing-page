import { describe, it } from 'node:test';
import assert from 'node:assert';
import { computeProjectTimelineSections } from './timelineSections.js';

describe('computeProjectTimelineSections', () => {
  it('returns null when expectedSprints missing', () => {
    const res = computeProjectTimelineSections({
      sprintCount: 10,
      expectedStartMinIdx: 2,
      expectedStartMaxIdx: 4,
      expectedSprints: null,
    });
    assert.equal(res, null);
  });

  it('produces three segments based on bounding envelope model', () => {
    const res = computeProjectTimelineSections({
      sprintCount: 20,
      expectedStartMinIdx: 5,
      expectedStartMaxIdx: 8,
      expectedSprints: { min: 2, max: 6 },
    });
    assert.ok(res);
    // Segment A: Minimum execution block [5, 5+2=7]
    assert.deepEqual(res.segmentA, { startIdx: 5, endIdx: 7 });
    // Segment B: Start slack [7, 8]
    assert.deepEqual(res.segmentB, { startIdx: 7, endIdx: 8 });
    // Segment C: Maximum execution block [8, 8+6=14]
    assert.deepEqual(res.segmentC, { startIdx: 8, endIdx: 14 });
    assert.equal(res.minEnd, 7);
    assert.equal(res.maxEnd, 14);
  });

  it('clamps indices and produces three contiguous segments', () => {
    const res = computeProjectTimelineSections({
      sprintCount: 10, // maxIdx=9
      expectedStartMinIdx: -5,
      expectedStartMaxIdx: 50,
      expectedSprints: { min: 3, max: 4 },
    });
    assert.ok(res);
    // Clamped: sMin=0, sMax=9
    const minEnd = Math.min(0 + 3, 9); // 3
    const maxEnd = Math.min(9 + 4, 9); // 9 (clamped)
    assert.deepEqual(res.segmentA, { startIdx: 0, endIdx: minEnd });
    assert.deepEqual(res.segmentB, { startIdx: minEnd, endIdx: 9 }); // [3, 9]
    assert.deepEqual(res.segmentC, { startIdx: 9, endIdx: 9 }); // clamped
    assert.equal(res.minEnd, minEnd);
    assert.equal(res.maxEnd, maxEnd);
  });

  it('defaults expectedStartMaxIdx to min when missing', () => {
    const res = computeProjectTimelineSections({
      sprintCount: 20,
      expectedStartMinIdx: 5,
      expectedStartMaxIdx: null,
      expectedSprints: { min: 2, max: 6 },
    });
    assert.ok(res);
    // sMax defaults to sMin (5)
    const minEnd = 5 + 2; // 7
    assert.deepEqual(res.segmentA, { startIdx: 5, endIdx: minEnd }); // [5, 7]
    // Segment B: [minEnd, maxStart] = [7, 5] -> Math.max(7, 5) = 7, so zero width
    assert.deepEqual(res.segmentB, { startIdx: 7, endIdx: 7 }); // zero width (clamped)
    assert.deepEqual(res.segmentC, { startIdx: 5, endIdx: 11 }); // [5, 5+6=11]
  });

  it('handles expectedStartMaxIdx < min by forcing max=min', () => {
    const res = computeProjectTimelineSections({
      sprintCount: 20,
      expectedStartMinIdx: 8,
      expectedStartMaxIdx: 3,
      expectedSprints: { min: 2, max: 6 },
    });
    assert.ok(res);
    // sMax forced to sMin (8)
    const minEnd = 8 + 2; // 10
    assert.deepEqual(res.segmentA, { startIdx: 8, endIdx: minEnd }); // [8, 10]
    // Segment B: [minEnd, maxStart] = [10, 8] -> Math.max(10, 8) = 10, so zero width
    assert.deepEqual(res.segmentB, { startIdx: 10, endIdx: 10 }); // zero width (clamped)
    assert.deepEqual(res.segmentC, { startIdx: 8, endIdx: 14 }); // [8, 8+6=14]
  });

  it('handles single sprint start (min = max)', () => {
    const res = computeProjectTimelineSections({
      sprintCount: 20,
      expectedStartMinIdx: 5,
      expectedStartMaxIdx: 5,
      expectedSprints: { min: 3, max: 6 },
    });
    assert.ok(res);
    const minEnd = 5 + 3; // 8
    assert.deepEqual(res.segmentA, { startIdx: 5, endIdx: minEnd }); // [5, 8]
    // Segment B: [minEnd, maxStart] = [8, 5] -> Math.max(8, 5) = 8, so zero width
    assert.deepEqual(res.segmentB, { startIdx: 8, endIdx: 8 }); // zero width (clamped)
    assert.deepEqual(res.segmentC, { startIdx: 5, endIdx: 11 }); // [5, 5+6=11]
  });

  it('handles delivery min = 0 (Segment A has zero width)', () => {
    const res = computeProjectTimelineSections({
      sprintCount: 20,
      expectedStartMinIdx: 5,
      expectedStartMaxIdx: 8,
      expectedSprints: { min: 0, max: 6 },
    });
    assert.ok(res);
    const minEnd = 5 + 0; // 5
    assert.deepEqual(res.segmentA, { startIdx: 5, endIdx: minEnd }); // [5, 5] zero width
    assert.deepEqual(res.segmentB, { startIdx: minEnd, endIdx: 8 }); // [5, 8]
    assert.deepEqual(res.segmentC, { startIdx: 8, endIdx: 14 }); // [8, 8+6=14]
  });

  it('handles Expected Start min = 0 (Segment A starts at timeline beginning)', () => {
    const res = computeProjectTimelineSections({
      sprintCount: 20,
      expectedStartMinIdx: 0,
      expectedStartMaxIdx: 3,
      expectedSprints: { min: 2, max: 6 },
    });
    assert.ok(res);
    const minEnd = 0 + 2; // 2
    assert.deepEqual(res.segmentA, { startIdx: 0, endIdx: minEnd }); // [0, 2]
    assert.deepEqual(res.segmentB, { startIdx: minEnd, endIdx: 3 }); // [2, 3]
    assert.deepEqual(res.segmentC, { startIdx: 3, endIdx: 9 }); // [3, 3+6=9]
  });

  it('handles maxStart = minEnd (Segment B has zero width)', () => {
    const res = computeProjectTimelineSections({
      sprintCount: 20,
      expectedStartMinIdx: 5,
      expectedStartMaxIdx: 7,
      expectedSprints: { min: 2, max: 6 },
    });
    assert.ok(res);
    const minEnd = 5 + 2; // 7
    assert.deepEqual(res.segmentA, { startIdx: 5, endIdx: minEnd }); // [5, 7]
    assert.deepEqual(res.segmentB, { startIdx: minEnd, endIdx: 7 }); // [7, 7] zero width
    assert.deepEqual(res.segmentC, { startIdx: 7, endIdx: 13 }); // [7, 7+6=13]
  });

  it('collapses to points in high confidence', () => {
    const res = computeProjectTimelineSections({
      sprintCount: 30,
      expectedStartMinIdx: 10,
      expectedStartMaxIdx: 12,
      expectedSprints: { min: 2, max: 6 },
      isHighConfidence: true,
    });
    assert.ok(res);
    assert.deepEqual(res.segmentA, { startIdx: 10, endIdx: 10 }); // collapsed
    assert.deepEqual(res.segmentB, { startIdx: 10, endIdx: 10 }); // collapsed
    assert.deepEqual(res.segmentC, { startIdx: 10, endIdx: 10 }); // collapsed
  });
});
