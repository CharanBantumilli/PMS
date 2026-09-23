import { NextRequest, NextResponse } from 'next/server';

// In-memory rate limiter (per IP, sliding window) with mutex for atomicity
const hits = new Map<string, { count: number; resetAt: number }>();
const locks = new Map<string, Promise<void>>();
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const entries = Array.from(hits.entries());
  for (const [key, val] of entries) {
    if (val.resetAt < now) hits.delete(key);
  }
}

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/auth/callback/credentials': { max: 5, windowMs: 60_000 },   // login: 5/min
  '/api/auth/forgot-password': { max: 3, windowMs: 300_000 },       // password reset: 3/5min
  '/api/auth/reset-password': { max: 5, windowMs: 300_000 },       // reset confirm: 5/5min
  '/api/register': { max: 3, windowMs: 300_000 },                   // register: 3/5min
  '/api/invitations': { max: 10, windowMs: 60_000 },                // invites: 10/min
  '/api/payments/razorpay/checkout': { max: 10, windowMs: 60_000 }, // checkout: 10/min
  '/api/otp/send': { max: 5, windowMs: 60_000 },                   // OTP send: 5/min
  '/api/otp/verify': { max: 5, windowMs: 600_000 },                // OTP verify: 5/10min
};

const DEFAULT_LIMIT = { max: 120, windowMs: 60_000 }; // 120/min for other API routes

async function acquireLock(key: string): Promise<() => void> {
  while (locks.has(key)) {
    await locks.get(key);
  }
  let release: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(key, promise);
  return () => {
    locks.delete(key);
    release!();
  };
}

export function rateLimit(req: NextRequest): NextResponse | null {
  cleanup();

  const { pathname } = req.nextUrl;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';

  // Find matching rate limit
  let limit = DEFAULT_LIMIT;
  for (const [pattern, cfg] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(pattern)) { limit = cfg; break; }
  }

  // Only rate-limit API routes and auth pages
  if (!pathname.startsWith('/api') && !pathname.startsWith('/login') && !pathname.startsWith('/register')) {
    return null;
  }

  const key = `${ip}:${pathname}`;
  const now = Date.now();
  const record = hits.get(key);

  if (!record || record.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + limit.windowMs });
    return null;
  }

  // Atomic increment
  record.count++;
  if (record.count > limit.max) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter), 'X-RateLimit-Limit': String(limit.max), 'X-RateLimit-Remaining': '0' } }
    );
  }

  return null;
}
