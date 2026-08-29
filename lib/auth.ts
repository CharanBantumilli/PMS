import { PrismaAdapter } from '@next-auth/prisma-adapter';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

type OrganizationRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'HOUSEKEEPER' | 'ACCOUNTANT';

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
      isSuperAdmin?: boolean;
    };
  }
  interface User {
    id: string;
    email: string;
    organizationId?: string | null;
    role?: OrganizationRole;
    isSuperAdmin?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    organizationId?: string | null;
    organizationSlug?: string | null;
    role?: OrganizationRole;
    isSuperAdmin?: boolean;
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
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: { organization: true },
        });
        if (!user || !user.hashedPassword) return null;
        if (user.status === 'SUSPENDED') return null;
        const ok = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!ok) return null;
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          organizationId: user.organizationId,
          organizationSlug: user.organization?.slug ?? null,
          role: user.role,
          isSuperAdmin: user.isSuperAdmin,
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
            const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000); // 30 days
            await prisma.userSession.create({
              data: {
                organizationId: u.organizationId,
                userId: u.id,
                sessionToken: `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`,
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
        token.isSuperAdmin = (user as any).isSuperAdmin;
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
        session.user.isSuperAdmin = token.isSuperAdmin;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
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
