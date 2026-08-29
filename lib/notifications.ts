import { prisma } from './prisma';

type NotificationType =
  | 'BOOKING_NEW' | 'BOOKING_CANCELLED' | 'CHECK_IN' | 'CHECK_OUT'
  | 'PAYMENT_RECEIVED' | 'PAYMENT_FAILED' | 'INVOICE_SENT' | 'INVOICE_OVERDUE'
  | 'HOUSEKEEPING_ASSIGNED' | 'HOUSEKEEPING_COMPLETED'
  | 'MAINTENANCE_NEW' | 'MAINTENANCE_URGENT'
  | 'GUEST_NEW' | 'STAFF_INVITED' | 'CHANNEL_ERROR' | 'WEBHOOK_FAILED'
  | 'PAYMENT_METHOD_FAILED' | 'SUBSCRIPTION_EXPIRING'
  | 'LOW_OCCUPANCY' | 'SYSTEM';

type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type CreateNotificationInput = {
  organizationId: string;
  userIds: string[]; // who to notify; can be multiple users
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  entity?: string;
  entityId?: string;
  actionUrl?: string;
  metadata?: any;
  expiresAt?: Date;
};

/**
 * Create notifications for one or more users. Each user gets a separate row.
 * If userIds is empty, this is a no-op.
 */
export async function createNotification(input: CreateNotificationInput) {
  if (!input.userIds || input.userIds.length === 0) return [];
  const rows = input.userIds.map((userId) => ({
    organizationId: input.organizationId,
    userId,
    type: input.type,
    priority: input.priority || 'NORMAL',
    title: input.title,
    message: input.message,
    entity: input.entity,
    entityId: input.entityId,
    actionUrl: input.actionUrl,
    metadata: input.metadata,
    expiresAt: input.expiresAt,
  }));
  return prisma.notification.createMany({ data: rows });
}

/**
 * Notify all users in an organization (except optionally the actor).
 * Respects each user's in-app preferences.
 */
export async function notifyOrganization(opts: {
  organizationId: string;
  exceptUserId?: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  entity?: string;
  entityId?: string;
  actionUrl?: string;
  metadata?: any;
}) {
  const users = await prisma.user.findMany({
    where: { organizationId: opts.organizationId, status: 'ACTIVE', ...(opts.exceptUserId ? { NOT: { id: opts.exceptUserId } } : {}) },
    select: { id: true },
  });
  if (users.length === 0) return;
  await createNotification({
    organizationId: opts.organizationId,
    userIds: users.map((u) => u.id),
    type: opts.type,
    title: opts.title,
    message: opts.message,
    priority: opts.priority,
    entity: opts.entity,
    entityId: opts.entityId,
    actionUrl: opts.actionUrl,
    metadata: opts.metadata,
  });
}

/**
 * Notify only users with specific roles in the organization.
 */
export async function notifyByRole(opts: {
  organizationId: string;
  roles: string[];
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  entity?: string;
  entityId?: string;
  actionUrl?: string;
  metadata?: any;
}) {
  const users = await prisma.user.findMany({
    where: { organizationId: opts.organizationId, status: 'ACTIVE', role: { in: opts.roles as any } },
    select: { id: true },
  });
  if (users.length === 0) return;
  await createNotification({
    organizationId: opts.organizationId,
    userIds: users.map((u) => u.id),
    type: opts.type,
    title: opts.title,
    message: opts.message,
    priority: opts.priority,
    entity: opts.entity,
    entityId: opts.entityId,
    actionUrl: opts.actionUrl,
    metadata: opts.metadata,
  });
}
