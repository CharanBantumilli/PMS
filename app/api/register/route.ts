import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validators';

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendEmailOtp(email: string, code: string) {
  // Intentionally reads from ANY org's SMTP config — during registration
  // the user has no org yet, so we use whichever system-wide SMTP is enabled.
  const smtpConfig = await prisma.integrationConfig.findFirst({
    where: { type: 'SMTP', isEnabled: true },
  }).catch(() => null);
  if (!smtpConfig) return;
  const config = smtpConfig.config as any;
  if (!config.host || !config.username || !config.password || !config.fromEmail) return;
  try {
    const nodemailer = (await import('nodemailer')).default;
    const transport = nodemailer.createTransport({
      host: String(config.host),
      port: Number(config.port || 587),
      secure: String(config.secure ?? 'false') === 'true',
      auth: { user: String(config.username), pass: String(config.password) },
    });
    await transport.sendMail({
      from: `"PMS" <${config.fromEmail}>`,
      to: email,
      subject: `Your verification code: ${code}`,
      html: `
        <div style="font-family:sans-serif;padding:24px;max-width:400px;margin:0 auto">
          <h2 style="margin:0 0 8px;font-size:20px">Verify your email</h2>
          <p style="color:#64748b;margin:0 0 16px">Use this code to complete your registration:</p>
          <div style="background:#f1f5f9;border-radius:8px;padding:16px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;color:#0f172a">${code}</div>
          <p style="color:#94a3b8;font-size:12px;margin-top:16px;text-align:center">This code expires in 10 minutes. Do not share it with anyone.</p>
        </div>
      `,
    });
  } catch (e) { console.error('Failed to send verification email:', e); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      );
    }

    const { organizationName, organizationSlug, name, email, password } = result.data;

    const normalizedEmail = email.toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser && existingUser.status === 'PENDING_VERIFICATION' && existingUser.organizationId) {
      // Clean up abandoned registration — user never completed OTP
      const abandonedOrgId = existingUser.organizationId;
      await prisma.user.delete({ where: { id: existingUser.id } });
      await prisma.organization.delete({ where: { id: abandonedOrgId } }).catch(() => {});
    } else if (existingUser) {
      return NextResponse.json(
        { error: 'Email already in use' },
        { status: 409 }
      );
    }

    const existingOrg = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: 'Organization slug already taken' },
        { status: 409 }
      );
    }

    const hashedPassword = await hash(password, 12);

    const txResult = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          slug: organizationSlug,
          email: normalizedEmail,
          maxProperties: 1,
          maxUsers: 5,
          maxUnits: 50,
        },
      });

      const user = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          emailVerified: null,
          hashedPassword,
          role: 'OWNER',
          organizationId: organization.id,
          status: 'PENDING_VERIFICATION',
        },
      });

      return { organization, user };
    });

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otpCode.deleteMany({ where: { email: normalizedEmail, purpose: 'REGISTER' } });
    await prisma.otpCode.create({
      data: { email: normalizedEmail, code, purpose: 'REGISTER', expiresAt },
    });

    // System-wide SMTP config (see sendEmailOtp comment above)
    const smtpConfig = await prisma.integrationConfig.findFirst({
      where: { type: 'SMTP', isEnabled: true },
    }).catch(() => null);

    let emailSent = false;
    if (smtpConfig) {
      const cfg = smtpConfig.config as any;
      if (cfg.host && cfg.username && cfg.password && cfg.fromEmail) {
        await sendEmailOtp(normalizedEmail, code);
        emailSent = true;
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Verification code sent to your email',
      userId: txResult.user.id,
      organizationId: txResult.organization.id,
      ...(process.env.NODE_ENV !== 'production' && !emailSent ? { debug_code: code } : {}),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
