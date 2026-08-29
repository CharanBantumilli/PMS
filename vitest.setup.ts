import '@testing-library/jest-dom/vitest';
import { getServerSession } from 'next-auth';
import { beforeEach, vi } from 'vitest';

// Mock next-auth
vi.mock('next-auth', () => {
  const session = {
    user: {
      id: 'default-user',
      email: 'default@test.com',
      organizationId: 'default-org',
      organizationSlug: 'default',
      role: 'OWNER',
      isSuperAdmin: false,
    },
    expires: '2099-01-01',
  };
  return {
    getServerSession: vi.fn(() => Promise.resolve(session)),
    default: vi.fn(),
  };
});

vi.mock('next-auth/providers/credentials', () => ({
  default: vi.fn(() => ({ name: 'credentials', credentials: {}, authorize: vi.fn() })),
}));

vi.mock('@next-auth/prisma-adapter', () => ({
  PrismaAdapter: vi.fn(),
}));

// Mock Prisma client
vi.mock('./lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    property: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    unit: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    guest: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    booking: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    payment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    invoice: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    expense: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    housekeepingTask: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    maintenanceTicket: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    channel: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    channelSyncLog: {
      create: vi.fn(),
    },
    ratePlan: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    seasonalRate: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    rateRestriction: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    unitTypeDefinition: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    activityLog: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    notification: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    invitation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userSession: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    apiKey: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    webhook: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    webhookDelivery: {
      create: vi.fn(),
    },
    integrationConfig: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    twoFactorSecret: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn({
      user: { create: vi.fn() },
      organization: { create: vi.fn() },
    })),
    $executeRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $disconnect: vi.fn(),
  },
}));

// Set test environment variables
process.env.NEXTAUTH_SECRET = 'test-secret-for-unit-tests';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Set a default session mock that persists across tests
const defaultSession = {
  user: {
    id: 'default-user',
    email: 'default@test.com',
    organizationId: 'default-org',
    organizationSlug: 'default',
    role: 'OWNER' as string,
    isSuperAdmin: false,
  },
  expires: '2099-01-01',
};

// Establish the default session before each test (and after any clearAllMocks)
import { prisma } from './lib/prisma';
beforeEach(() => {
  vi.mocked(getServerSession).mockResolvedValue(defaultSession as any);
  // Reset all prisma mock call history (but keep implementations)
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.user.findFirst).mockReset();
  vi.mocked(prisma.user.findMany).mockReset();
  vi.mocked(prisma.user.create).mockResolvedValue(0 as any);
  vi.mocked(prisma.user.update).mockResolvedValue(0 as any);
  vi.mocked(prisma.user.updateMany).mockResolvedValue(0 as any);
  vi.mocked(prisma.user.count).mockResolvedValue(0 as any);
  vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: 'default-org' } as any);
  vi.mocked(prisma.organization.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.organization.findMany).mockReset();
  vi.mocked(prisma.organization.create).mockResolvedValue(0 as any);
  vi.mocked(prisma.organization.update).mockResolvedValue(0 as any);
  vi.mocked(prisma.organization.upsert).mockResolvedValue(0 as any);
  vi.mocked(prisma.property.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.property.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.property.findMany).mockReset();
  vi.mocked(prisma.property.create).mockResolvedValue(0 as any);
  vi.mocked(prisma.property.update).mockResolvedValue(0 as any);
  vi.mocked(prisma.unit.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.unit.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.unit.findMany).mockReset();
  vi.mocked(prisma.unit.create).mockResolvedValue(0 as any);
  vi.mocked(prisma.unit.update).mockResolvedValue(0 as any);
  vi.mocked(prisma.unit.count).mockResolvedValue(0 as any);
  vi.mocked(prisma.guest.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.guest.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.guest.findMany).mockReset();
  vi.mocked(prisma.guest.create).mockResolvedValue(0 as any);
  vi.mocked(prisma.guest.update).mockResolvedValue(0 as any);
  vi.mocked(prisma.booking.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.booking.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.booking.findMany).mockReset();
  vi.mocked(prisma.booking.create).mockResolvedValue(0 as any);
  vi.mocked(prisma.booking.update).mockResolvedValue(0 as any);
  vi.mocked(prisma.booking.count).mockResolvedValue(0 as any);
  vi.mocked(prisma.payment.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.payment.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.payment.findMany).mockReset();
  vi.mocked(prisma.payment.create).mockResolvedValue(0 as any);
  vi.mocked(prisma.invoice.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.invoice.findMany).mockReset();
  vi.mocked(prisma.invoice.create).mockResolvedValue(0 as any);
  vi.mocked(prisma.invoice.update).mockResolvedValue(0 as any);
  vi.mocked(prisma.expense.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.expense.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.expense.findMany).mockReset();
  vi.mocked(prisma.expense.create).mockResolvedValue(0 as any);
  vi.mocked(prisma.expense.update).mockResolvedValue(0 as any);
  vi.mocked(prisma.housekeepingTask.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.housekeepingTask.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.housekeepingTask.findMany).mockReset();
  vi.mocked(prisma.housekeepingTask.create).mockResolvedValue(0 as any);
  vi.mocked(prisma.housekeepingTask.update).mockResolvedValue(0 as any);
  vi.mocked(prisma.maintenanceTicket.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.maintenanceTicket.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.maintenanceTicket.findMany).mockReset();
  vi.mocked(prisma.maintenanceTicket.create).mockResolvedValue(0 as any);
  vi.mocked(prisma.maintenanceTicket.update).mockResolvedValue(0 as any);
  vi.mocked(prisma.channel.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.channel.findMany).mockReset();
  vi.mocked(prisma.channel.create).mockResolvedValue(0 as any);
  vi.mocked(prisma.channel.update).mockResolvedValue(0 as any);
  vi.mocked(prisma.channel.delete).mockResolvedValue(0 as any);
  vi.mocked(prisma.channelSyncLog.create).mockResolvedValue(0 as any);
  vi.mocked(prisma.notification.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.notification.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.notification.findMany).mockReset();
  vi.mocked(prisma.notification.create).mockResolvedValue(0 as any);
  vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 0 } as any);
  vi.mocked(prisma.notification.update).mockResolvedValue(0 as any);
  vi.mocked(prisma.notification.updateMany).mockResolvedValue(0 as any);
  vi.mocked(prisma.notification.count).mockResolvedValue(0 as any);
  vi.mocked(prisma.notification.delete).mockResolvedValue(0 as any);
  vi.mocked(prisma.notification.deleteMany).mockResolvedValue(0 as any);
  vi.mocked(prisma.activityLog.create).mockResolvedValue(0 as any);
  vi.mocked(prisma.twoFactorSecret.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.twoFactorSecret.upsert).mockResolvedValue(0 as any);
  vi.mocked(prisma.twoFactorSecret.update).mockResolvedValue(0 as any);
  vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.integrationConfig.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.integrationConfig.findMany).mockReset();
  vi.mocked(prisma.integrationConfig.create).mockResolvedValue(0 as any);
  vi.mocked(prisma.integrationConfig.update).mockResolvedValue(0 as any);
  vi.mocked(prisma.integrationConfig.upsert).mockResolvedValue(0 as any);
});
