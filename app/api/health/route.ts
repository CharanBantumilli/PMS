import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const isProd = process.env.NODE_ENV === 'production';
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      ...(isProd ? {} : { database: 'connected' }),
    });
  } catch {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      ...(isProd ? {} : { database: 'disconnected' }),
    }, { status: 503 });
  }
}
