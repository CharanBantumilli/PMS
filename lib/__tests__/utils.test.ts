import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  nightsBetween,
  daysFromNow,
  generateCode,
  getInitials,
  statusLabel,
  cn,
} from '@/lib/utils';

describe('cn (className merger)', () => {
  it('merges class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out falsy values', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
  });

  it('resolves Tailwind conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});

describe('formatCurrency', () => {
  it('formats USD with $ symbol', () => {
    expect(formatCurrency(100, 'USD')).toContain('100');
    expect(formatCurrency(100, 'USD')).toContain('$');
  });

  it('formats INR with ₹ symbol', () => {
    const result = formatCurrency(1000, 'INR');
    expect(result).toContain('1,000');
    expect(result).toMatch(/₹/);
  });

  it('formats EUR with € symbol', () => {
    expect(formatCurrency(50, 'EUR')).toContain('€');
  });

  it('handles zero', () => {
    expect(formatCurrency(0, 'USD')).toContain('0');
  });

  it('handles negative amounts', () => {
    const result = formatCurrency(-50, 'USD');
    expect(result).toContain('50');
  });

  it('defaults to USD', () => {
    const result = formatCurrency(100);
    expect(result).toContain('$');
  });

  it('handles string input', () => {
    const result = formatCurrency('99.50', 'USD');
    expect(result).toContain('99.50');
  });

  it('handles non-numeric strings gracefully', () => {
    const result = formatCurrency('not-a-number' as any);
    expect(result).toBeDefined();
  });
});

describe('formatDate', () => {
  it('formats a date in a readable way', () => {
    const result = formatDate(new Date('2026-01-15'));
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2026/);
  });

  it('handles ISO string', () => {
    const result = formatDate('2026-12-25');
    expect(result).toMatch(/Dec/);
    expect(result).toMatch(/25/);
    expect(result).toMatch(/2026/);
  });
});

describe('formatDateTime', () => {
  it('includes both date and time', () => {
    const result = formatDateTime(new Date('2026-01-15T14:30:00'));
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2026/);
  });
});

describe('nightsBetween', () => {
  it('returns 0 for same day', () => {
    const d = new Date('2026-01-15');
    expect(nightsBetween(d, d)).toBe(0);
  });

  it('calculates nights for multi-day stays', () => {
    expect(nightsBetween('2026-01-15', '2026-01-18')).toBe(3);
  });

  it('returns 0 for invalid (departure before arrival)', () => {
    expect(nightsBetween('2026-01-18', '2026-01-15')).toBe(0);
  });

  it('handles single night', () => {
    expect(nightsBetween('2026-01-15', '2026-01-16')).toBe(1);
  });

  it('handles long stays', () => {
    expect(nightsBetween('2026-01-01', '2026-01-31')).toBe(30);
  });
});

describe('daysFromNow', () => {
  it('returns a date N days in the future', () => {
    const now = new Date();
    const future = daysFromNow(7);
    const diff = future.getTime() - now.getTime();
    const days = Math.round(diff / 86400000);
    expect(days).toBeGreaterThanOrEqual(6);
    expect(days).toBeLessThanOrEqual(7);
  });

  it('handles negative days (past)', () => {
    const now = new Date();
    const past = daysFromNow(-3);
    expect(past.getTime()).toBeLessThan(now.getTime());
  });

  it('handles zero', () => {
    const now = Date.now();
    const result = daysFromNow(0).getTime();
    expect(Math.abs(result - now)).toBeLessThan(1000);
  });
});

describe('generateCode', () => {
  it('returns code without prefix by default', () => {
    const code = generateCode();
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
  });

  it('returns code with prefix', () => {
    const code = generateCode('B');
    expect(code).toMatch(/^B-[A-Z2-9]{8}$/);
  });

  it('generates unique codes', () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) codes.add(generateCode());
    expect(codes.size).toBe(100);
  });

  it('uses only unambiguous characters (no 0, O, 1, I)', () => {
    const code = generateCode('', 50);
    expect(code).not.toMatch(/[0O1I]/);
  });

  it('respects custom length', () => {
    expect(generateCode('', 12)).toHaveLength(12);
    expect(generateCode('', 4)).toHaveLength(4);
  });
});

describe('getInitials', () => {
  it('returns "?" for null/undefined/empty', () => {
    expect(getInitials(null)).toBe('?');
    expect(getInitials(undefined)).toBe('?');
    expect(getInitials('')).toBe('?');
  });

  it('returns uppercase initials for a full name', () => {
    expect(getInitials('Alex Morgan')).toBe('AM');
  });

  it('returns first letter for single name', () => {
    expect(getInitials('Cher')).toBe('C');
  });

  it('limits to 2 characters', () => {
    expect(getInitials('John Michael Smith')).toBe('JM');
  });

  it('handles extra whitespace', () => {
    expect(getInitials('  Alex  Morgan  ')).toBe('AM');
  });
});

describe('statusLabel', () => {
  it('converts snake_case to Title Case', () => {
    expect(statusLabel('CHECKED_IN')).toBe('Checked In');
    expect(statusLabel('VACANT_CLEAN')).toBe('Vacant Clean');
    expect(statusLabel('OCCUPIED_DIRTY')).toBe('Occupied Dirty');
  });

  it('handles already capitalized input', () => {
    expect(statusLabel('PAID')).toBe('Paid');
  });

  it('handles single word', () => {
    expect(statusLabel('PENDING')).toBe('Pending');
  });
});

describe('formatCurrency — Indian numbering & robustness', () => {
  it('groups INR using the lakh system (1,50,000 not 150,000)', () => {
    expect(formatCurrency(150000, 'INR')).toBe('₹1,50,000.00');
  });

  it('handles crore-scale INR amounts', () => {
    expect(formatCurrency(12500000, 'INR')).toBe('₹1,25,00,000.00');
  });

  it('small INR amounts render plainly', () => {
    expect(formatCurrency(8500, 'INR')).toBe('₹8,500.00');
  });

  it('keeps western grouping for USD at the same magnitude', () => {
    expect(formatCurrency(150000, 'USD')).toBe('$150,000.00');
  });

  it('falls back gracefully for invalid currency codes instead of throwing', () => {
    const out = formatCurrency(99.5, 'IND');
    expect(out).toContain('IND');
    expect(out).toContain('99.50');
  });

  it('never returns NaN for garbage input', () => {
    const out = formatCurrency('not-a-number' as any, 'INR');
    expect(out).not.toContain('NaN');
  });

  it('currencyLocale maps rupee-family currencies to Indian grouping', async () => {
    const { currencyLocale } = await import('@/lib/utils');
    expect(currencyLocale('INR')).toBe('en-IN');
    expect(currencyLocale('NPR')).toBe('en-IN');
    expect(currencyLocale('USD')).toBe('en-US');
    expect(currencyLocale('xyz')).toBe('en-US');
  });
});

describe('generateCode', () => {
  it('uses the requested prefix and length', () => {
    const code = generateCode('B', 8);
    expect(code.startsWith('B-') || code.startsWith('B')).toBe(true);
    expect(code.replace('-', '').length).toBeGreaterThanOrEqual(8);
  });

  it('produces uppercase alphanumeric codes', () => {
    const code = generateCode('', 12);
    expect(/^[A-Z0-9]+$/.test(code.replace('-', ''))).toBe(true);
  });
});

describe('nightsBetween', () => {
  it('counts inclusive nights correctly', async () => {
    const { nightsBetween: nb } = await import('@/lib/utils');
    const a = new Date('2026-09-01T00:00:00Z');
    const d = new Date('2026-09-05T00:00:00Z');
    expect(nb(a, d)).toBe(4);
  });

  it('same-day is zero nights', async () => {
    const { nightsBetween: nb } = await import('@/lib/utils');
    const t = new Date('2026-09-01T00:00:00Z');
    expect(nb(t, t)).toBeLessThanOrEqual(0);
  });

  it('accepts ISO date strings', async () => {
    const { nightsBetween: nb } = await import('@/lib/utils');
    expect(nb('2026-09-01', '2026-09-03')).toBeGreaterThanOrEqual(1);
  });
});
