import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getDisplayValueForAnnualizedEbitda,
  getDisplayValueForInYearEbitda,
  getDisplayValueForSprintRange,
  getDisplayValueForDuration,
} from './confidenceMode.js';

describe('getDisplayValueForAnnualizedEbitda', () => {
  it('returns min when range provided', () => {
    assert.strictEqual(getDisplayValueForAnnualizedEbitda({ min: 10, max: 90 }), 10);
  });
  it('returns 0 for zero range', () => {
    assert.strictEqual(getDisplayValueForAnnualizedEbitda({ min: 0, max: 0 }), 0);
  });
  it('returns 0 for null', () => {
    assert.strictEqual(getDisplayValueForAnnualizedEbitda(null), 0);
  });
  it('returns 0 for undefined', () => {
    assert.strictEqual(getDisplayValueForAnnualizedEbitda(undefined), 0);
  });
});

describe('getDisplayValueForInYearEbitda', () => {
  it('returns min of inYear.min and ann.min when inYear exceeds ann', () => {
    const inYear = { min: 50, max: 70 };
    const ann = { min: 20, max: 80 };
    assert.strictEqual(getDisplayValueForInYearEbitda(inYear, ann), 20);
  });
  it('returns inYear.min when inYear is below ann', () => {
    const inYear = { min: 10, max: 30 };
    const ann = { min: 40, max: 60 };
    assert.strictEqual(getDisplayValueForInYearEbitda(inYear, ann), 10);
  });
  it('handles null gracefully', () => {
    assert.strictEqual(getDisplayValueForInYearEbitda(null, { min: 20 }), 0);
    assert.strictEqual(getDisplayValueForInYearEbitda({ min: 10 }, null), 0);
  });
});

describe('getDisplayValueForSprintRange', () => {
  it('returns startSprintId when both present', () => {
    const range = { startSprintId: 's05', endSprintId: 's10' };
    assert.strictEqual(getDisplayValueForSprintRange(range), 's05');
  });
  it('returns endSprintId when start missing', () => {
    const range = { endSprintId: 's03' };
    assert.strictEqual(getDisplayValueForSprintRange(range), 's03');
  });
  it('returns null for empty object', () => {
    assert.strictEqual(getDisplayValueForSprintRange({}), null);
  });
  it('returns null for null/undefined', () => {
    assert.strictEqual(getDisplayValueForSprintRange(null), null);
    assert.strictEqual(getDisplayValueForSprintRange(undefined), null);
  });
});

describe('getDisplayValueForDuration', () => {
  it('returns durationMin when range provided', () => {
    const assignment = { durationMin: 3, durationMax: 6 };
    assert.strictEqual(getDisplayValueForDuration(assignment), 3);
  });
  it('returns 1 for empty object', () => {
    assert.strictEqual(getDisplayValueForDuration({}), 1);
  });
  it('returns 1 for null/undefined', () => {
    assert.strictEqual(getDisplayValueForDuration(null), 1);
    assert.strictEqual(getDisplayValueForDuration(undefined), 1);
  });
});
