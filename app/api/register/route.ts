import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validators';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = registerSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }
    const { organizationName, organizationSlug, name, email, password, country } = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
    }
    const existingOrg = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
    if (existingOrg) {
      return NextResponse.json({ error: 'That workspace URL is taken.' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const result = await prisma.$transaction(async (tx: any) => {
      const org = await tx.organization.create({
        data: {
          name: organizationName,
          slug: organizationSlug,
          email: email,
          country: country || 'IN',
          currency: 'INR',
          planStatus: 'TRIAL',
          trialEndsAt,
          maxProperties: 5,
          maxUsers: 10,
          maxUnits: 200,
        },
      });
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          name,
          hashedPassword,
          role: 'OWNER',
          status: 'ACTIVE',
          organizationId: org.id,
        },
      });
      return { org, user };
    });

    await prisma.activityLog.create({
      data: {
        organizationId: result.org.id,
        userId: result.user.id,
        action: 'CREATE',
        entity: 'Organization',
        entityId: result.org.id,
        description: `Organization ${result.org.name} created`,
      },
    });

    return NextResponse.json({ ok: true, organizationId: result.org.id });
  } catch (e: any) {
    console.error('register error', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
