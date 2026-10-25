// Tests for the chart's axis maths.

import { describe, it, expect } from 'vitest';
import { niceStep, linearScale, logScale } from '../src/lib/scale.js';

describe('axis steps', () => {
  it('picks round steps', () => {
    expect(niceStep(2684)).toBe(500);
    expect(niceStep(35)).toBe(10);
    expect(niceStep(6)).toBe(1);
  });

  it('never returns 0 or crashes on odd input', () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(-5)).toBe(1);
    expect(niceStep(NaN)).toBe(1);
  });
});

describe('linear scale', () => {
  const scale = linearScale(2684, 20, 320);

  it('labels 0 to 3000 in steps of 500', () => {
    expect(scale.ticks).toEqual([0, 500, 1000, 1500, 2000, 2500, 3000]);
  });

  it('puts 0 at the bottom and the top label at the top', () => {
    expect(scale.toY(0)).toBe(320);
    expect(scale.toY(3000)).toBe(20);
    expect(scale.toY(1500)).toBe(170);
  });
});

describe('log scale', () => {
  const scale = logScale(2684, 20, 320);

  it('labels each power of ten', () => {
    expect(scale.ticks).toEqual([10, 100, 1000, 10000]);
  });

  it('spaces powers of ten evenly', () => {
    expect(scale.toY(10)).toBe(320);
    expect(scale.toY(100)).toBe(220);
    expect(scale.toY(1000)).toBe(120);
  });

  it('keeps values below the floor on the floor', () => {
    expect(scale.toY(2)).toBe(320);
    expect(scale.toY(0)).toBe(320);
  });
});
