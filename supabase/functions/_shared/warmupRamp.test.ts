import { describe, it, expect } from 'vitest';
import { computeDailyCap, DEFAULT_RAMP } from './warmupRamp';

describe('computeDailyCap', () => {
  it('returns 0 before the warm-up start date', () => {
    const now = new Date('2026-07-01T12:00:00Z');
    expect(computeDailyCap('2026-07-05', now, 50)).toBe(0);
  });

  it('returns the first ramp step cap on day 0', () => {
    const now = new Date('2026-07-05T12:00:00Z');
    expect(computeDailyCap('2026-07-05', now, 50)).toBe(DEFAULT_RAMP[0].cap);
  });

  it('advances to the next ramp step once its threshold is reached', () => {
    const start = '2026-07-01';
    const now = new Date('2026-07-08T00:00:00Z'); // 7 days later
    const step = [...DEFAULT_RAMP].reverse().find((s) => 7 >= s.afterDays)!;
    expect(computeDailyCap(start, now, 999)).toBe(step.cap);
  });

  it('never exceeds the configured target cap, even late in the ramp', () => {
    const now = new Date('2027-01-01T00:00:00Z'); // far past the whole ramp
    expect(computeDailyCap('2026-01-01', now, 10)).toBe(10);
  });

  it('accepts a custom ramp table', () => {
    const customRamp = [{ afterDays: 0, cap: 2 }, { afterDays: 3, cap: 100 }];
    const now = new Date('2026-07-04T00:00:00Z'); // 3 days after 2026-07-01
    expect(computeDailyCap('2026-07-01', now, 999, customRamp)).toBe(100);
  });
});
