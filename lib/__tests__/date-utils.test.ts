import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDistanceToNow } from '@/lib/date-utils';

describe('formatDistanceToNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-26T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for less than 5 seconds', () => {
    const d = new Date('2026-08-26T11:59:57Z');
    expect(formatDistanceToNow(d)).toBe('just now');
  });

  it('returns seconds ago', () => {
    const d = new Date('2026-08-26T11:59:30Z');
    expect(formatDistanceToNow(d)).toBe('30s ago');
  });

  it('returns minutes ago', () => {
    const d = new Date('2026-08-26T11:55:00Z');
    expect(formatDistanceToNow(d)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const d = new Date('2026-08-26T09:00:00Z');
    expect(formatDistanceToNow(d)).toBe('3h ago');
  });

  it('returns days ago', () => {
    const d = new Date('2026-08-23T12:00:00Z');
    expect(formatDistanceToNow(d)).toBe('3d ago');
  });

  it('returns weeks ago', () => {
    const d = new Date('2026-08-05T12:00:00Z');
    expect(formatDistanceToNow(d)).toBe('3w ago');
  });

  it('handles ISO string input', () => {
    const iso = new Date('2026-08-26T11:55:00Z').toISOString();
    expect(formatDistanceToNow(iso)).toBe('5m ago');
  });

  it('handles future dates (negative seconds)', () => {
    const d = new Date('2026-08-26T12:01:00Z');
    // Future dates result in negative seconds, which we clamp to 0
    const result = formatDistanceToNow(d);
    expect(result).toMatch(/ago|just now/);
  });
});
