import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, jsonOk, jsonError } from '@/lib/api';

export async function GET() {
  const ctx = await apiContext();
  if (!ctx?.organizationId || !ctx.userId) return jsonError('Unauthorized', 401);

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { permissions: true, role: true },
  });
  if (!user) return jsonError('Not found', 404);

  return jsonOk({ permissions: (user.permissions as string[] | null) ?? null, role: user.role });
}
