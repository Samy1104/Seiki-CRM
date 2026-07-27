import { describe, it, expect } from 'vitest';
import { getTodaysWindowBounds, pickRandomSendTimes, type SendWindow } from './sendWindow';

const weekdayWindow: SendWindow = { days: [1, 2, 3, 4, 5], start: '08:00', end: '18:00' };

describe('getTodaysWindowBounds', () => {
  it('returns null on a day not in the window (Saturday)', () => {
    const saturday = new Date('2026-07-25T10:00:00'); // a Saturday
    expect(getTodaysWindowBounds(saturday, weekdayWindow)).toBeNull();
  });

  it('returns null once the window has already passed today', () => {
    const afterWindow = new Date('2026-07-27T19:00:00'); // Monday, 19:00, window ends 18:00
    expect(getTodaysWindowBounds(afterWindow, weekdayWindow)).toBeNull();
  });

  it('starts at the window start time when called before the window opens', () => {
    const beforeWindow = new Date('2026-07-27T06:00:00'); // Monday, 06:00
    const bounds = getTodaysWindowBounds(beforeWindow, weekdayWindow)!;
    expect(bounds.start.getHours()).toBe(8);
    expect(bounds.end.getHours()).toBe(18);
  });

  it('starts at "now" when called mid-window (remaining window only)', () => {
    const midWindow = new Date('2026-07-27T12:30:00'); // Monday, 12:30
    const bounds = getTodaysWindowBounds(midWindow, weekdayWindow)!;
    expect(bounds.start.getTime()).toBe(midWindow.getTime());
    expect(bounds.end.getHours()).toBe(18);
  });
});

describe('pickRandomSendTimes', () => {
  it('returns an empty array for count <= 0', () => {
    expect(pickRandomSendTimes(0, new Date('2026-07-27T08:00:00'), new Date('2026-07-27T18:00:00'))).toEqual([]);
  });

  it('returns exactly `count` timestamps, all within [start, end], in ascending order', () => {
    const start = new Date('2026-07-27T08:00:00');
    const end = new Date('2026-07-27T18:00:00');
    const times = pickRandomSendTimes(5, start, end);
    expect(times).toHaveLength(5);
    for (const t of times) {
      expect(t.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(t.getTime()).toBeLessThanOrEqual(end.getTime());
    }
    for (let i = 1; i < times.length; i++) {
      expect(times[i].getTime()).toBeGreaterThan(times[i - 1].getTime());
    }
  });

  it('spaces timestamps into distinct slots (stratified), not clustered, given a fixed rng', () => {
    const start = new Date('2026-07-27T08:00:00');
    const end = new Date('2026-07-27T18:00:00'); // 10h window = 600 min
    const times = pickRandomSendTimes(4, start, end, () => 0.5); // midpoint of each slot
    // 4 slots of 150 min each, midpoint => 75, 225, 375, 525 minutes after start
    const offsetsMin = times.map((t) => (t.getTime() - start.getTime()) / 60_000);
    expect(offsetsMin).toEqual([75, 225, 375, 525]);
  });
});
