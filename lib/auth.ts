import { PrismaAdapter } from '@next-auth/prisma-adapter';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from './prisma';

type OrganizationRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'HOUSEKEEPER' | 'ACCOUNTANT';

// Simple in-memory rate limiter for login attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function checkLoginRateLimit(email: string): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  const now = Date.now();
  const record = loginAttempts.get(email);
  if (record && record.resetAt > now) {
    if (record.count >= MAX_LOGIN_ATTEMPTS) return false;
    record.count++;
    return true;
  }
  loginAttempts.set(email, { count: 1, resetAt: now + LOCKOUT_DURATION_MS });
  return true;
}

function resetLoginAttempts(email: string) {
  loginAttempts.delete(email);
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      organizationId?: string | null;
      organizationSlug?: string | null;
      role?: OrganizationRole;
      permissions?: string[] | null;
    };
  }
  interface User {
    id: string;
    email: string;
    organizationId?: string | null;
    role?: OrganizationRole;
    permissions?: string[] | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    organizationId?: string | null;
    organizationSlug?: string | null;
    role?: OrganizationRole;
    permissions?: string[] | null;
    tokenVersion?: number;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const email = credentials.email.toLowerCase().trim();
        if (!checkLoginRateLimit(email)) return null; // rate limited

        const user = await prisma.user.findUnique({
          where: { email },
          include: { organization: true },
        });
        if (!user || !user.hashedPassword) { resetLoginAttempts(email); return null; }
        if (user.status === 'SUSPENDED' || user.status === 'PENDING_VERIFICATION') return null;
        const ok = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!ok) return null;
        resetLoginAttempts(email);

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return {
          id: user.id, email: user.email, name: user.name, image: user.image,
          organizationId: user.organizationId, organizationSlug: user.organization?.slug ?? null,
          role: user.role,
          permissions: (user.permissions as string[] | null) ?? null,
          tokenVersion: (user as any).tokenVersion ?? 0,
        };
      },
    }),
  ],
  events: {
    async signIn({ user, account, profile }) {
      if (user?.id) {
        // Track the sign-in in activity log
        try {
          const u = await prisma.user.findUnique({ where: { id: user.id } });
          if (u?.organizationId) {
            await prisma.activityLog.create({
              data: { organizationId: u.organizationId, userId: u.id, action: 'LOGIN', entity: 'User', entityId: u.id, description: `User ${u.email} signed in` },
            });
          }
        } catch {}
      }
    },
    async signOut({ token }) {
      if (token?.id) {
        try {
          const u = await prisma.user.findUnique({ where: { id: token.id as string } });
          if (u?.organizationId) {
            await prisma.activityLog.create({
              data: { organizationId: u.organizationId, userId: u.id, action: 'LOGOUT', entity: 'User', entityId: u.id, description: `User ${u.email} signed out` },
            });
          }
        } catch {}
      }
    },
  },
  callbacks: {
    async signIn({ user }) {
      // Create a user session record for security tracking
      if (user?.id) {
        try {
          const u = await prisma.user.findUnique({ where: { id: user.id } });
          if (u?.organizationId) {
            // Clean up expired sessions for this user
            await prisma.userSession.deleteMany({ where: { userId: u.id, OR: [{ expiresAt: { lt: new Date() } }, { isActive: false }] } });
            const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days
            await prisma.userSession.create({
              data: {
                organizationId: u.organizationId,
                userId: u.id,
                sessionToken: `sess_${crypto.randomUUID()}`,
                device: 'Web browser',
                isActive: true,
                lastActiveAt: new Date(),
                expiresAt,
              },
            });
          }
        } catch {}
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.organizationId = (user as any).organizationId;
        token.organizationSlug = (user as any).organizationSlug;
        token.role = (user as any).role;
        token.permissions = (user as any).permissions ?? null;
        token.tokenVersion = (user as any).tokenVersion ?? 0;
      }
      // Validate token version on every request (token revocation)
      // Skip for old tokens that don't have tokenVersion yet
      if (token.id && typeof token.tokenVersion === 'number') {
        try {
          const dbUser = await prisma.user.findUnique({ where: { id: token.id }, select: { tokenVersion: true } });
          if (dbUser && dbUser.tokenVersion !== token.tokenVersion) {
            // Token has been revoked — return empty token to force re-auth
            return {} as any;
          }
        } catch {}
      }
      if (trigger === 'update' && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          include: { organization: true },
        });
        if (fresh) {
          token.organizationId = fresh.organizationId;
          token.organizationSlug = fresh.organization?.slug ?? null;
          token.role = fresh.role;
          token.permissions = (fresh.permissions as string[] | null) ?? null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.organizationId = token.organizationId;
        session.user.organizationSlug = token.organizationSlug;
        session.user.role = token.role;
        session.user.permissions = token.permissions ?? null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
};

export async function auth() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
  return session;
}

export async function requireOrg() {
  const session = await requireAuth();
  if (!session.user.organizationId) throw new Error('No organization');
  return session;
}
