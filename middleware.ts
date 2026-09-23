import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { pageAllowed } from '@/lib/authz';
import { rateLimit } from '@/lib/rate-limit';

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');

  const isPublic =
    isAuthPage ||
    pathname.startsWith('/invite') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/register') ||
    pathname.startsWith('/api/invitations/accept') ||
    pathname.startsWith('/api/otp') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon');

  if (!token && !isPublic) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    if (pathname.startsWith('/')) {
      url.searchParams.set('callbackUrl', pathname);
    }
    return NextResponse.redirect(url);
  }

  if (token && isAuthPage) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    url.searchParams.delete('callbackUrl');
    return NextResponse.redirect(url);
  }

  // Authenticated staff hitting a dashboard page they're not allowed to open
  if (token && !pathname.startsWith('/api') && pathname.startsWith('/dashboard')) {
    const role = String((token as any).role || 'STAFF');
    if (!pageAllowed(pathname, role)) {
      const url = req.nextUrl.clone();
      url.pathname = '/no-access';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  // CSRF protection for state-changing API requests from authenticated browser sessions
  if (token && pathname.startsWith('/api') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    if (!pathname.startsWith('/api/auth') && !pathname.startsWith('/api/webhooks') && !pathname.startsWith('/api/register')) {
      const origin = req.headers.get('origin');
      const referer = req.headers.get('referer');
      const host = req.headers.get('host');
      const hasSessionCookie = req.cookies.get('next-auth.session-token') || req.cookies.get('__Secure-next-auth.session-token');
      // Only enforce CSRF for browser requests (those with session cookies and no Origin/Referer)
      if (hasSessionCookie) {
        const refUrl = origin || referer;
        if (!refUrl || !host) {
          return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
        }
        try {
          const parsedUrl = new URL(refUrl);
          if (parsedUrl.host !== host) {
            return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
          }
        } catch {
          return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
        }
      }
    }
  }

  const response = NextResponse.next();

  // Rate limiting
  const rlResponse = rateLimit(req);
  if (rlResponse) return rlResponse;

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.amazonaws.com https://*.cloudflarestorage.com; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests");
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
