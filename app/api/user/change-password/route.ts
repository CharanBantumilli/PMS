import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, jsonError, jsonOk, logActivity } from '@/lib/api';
import { hash, compare } from 'bcryptjs';
import { z } from 'zod';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128, 'New password must be at most 128 characters'),
});

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.userId) return jsonError('Unauthorized', 401);
  if (!ctx?.organizationId) return jsonError('Organization not found', 400);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);

  const { currentPassword, newPassword } = parsed.data;
  if (currentPassword === newPassword) return jsonError('New password must differ from current', 400);

  const user = await prisma.user.findUnique({ where: { id: ctx.userId } });
  if (!user?.hashedPassword) return jsonError('No password set', 400);

  const valid = await compare(currentPassword, user.hashedPassword);
  if (!valid) return jsonError('Current password is incorrect', 401);

  const hashedPassword = await hash(newPassword, 12);
  await prisma.user.update({ where: { id: ctx.userId }, data: { hashedPassword, tokenVersion: { increment: 1 } } });

  try {
    await logActivity({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'UPDATE',
      entity: 'User',
      entityId: ctx.userId,
      description: 'Password changed',
    });
  } catch {
    // Don't fail the response if audit logging fails
  }

  return jsonOk({ ok: true, message: 'Password changed successfully.' });
}
