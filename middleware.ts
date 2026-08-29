import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { pageAllowed } from '@/lib/authz';

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
  const isPublic =
    pathname === '/' ||
    isAuthPage ||
    pathname.startsWith('/invite') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/register') ||
    pathname.startsWith('/api/invitations/accept') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon');

  if (!token && !isPublic) {
    // API clients get a JSON 401; pages redirect to login
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
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
    const isSuperAdmin = !!(token as any).isSuperAdmin;
    if (!pageAllowed(pathname, role, isSuperAdmin)) {
      const url = req.nextUrl.clone();
      url.pathname = '/no-access';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
