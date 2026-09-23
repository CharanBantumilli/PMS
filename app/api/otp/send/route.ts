import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonError, jsonOk } from '@/lib/api';
import crypto from 'crypto';

const otpAttempts = new Map<string, { count: number; resetAt: number }>();
const OTP_RATE_LIMIT = { max: 5, windowMs: 60_000 };

function checkOtpRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = otpAttempts.get(identifier);
  if (!record || record.resetAt < now) {
    otpAttempts.set(identifier, { count: 1, resetAt: now + OTP_RATE_LIMIT.windowMs });
    return true;
  }
  record.count++;
  return record.count <= OTP_RATE_LIMIT.max;
}

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

async function sendEmailOtp(email: string, code: string) {
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
          <p style="color:#64748b;margin:0 0 16px">Use this code to complete your sign-in:</p>
          <div style="background:#f1f5f9;border-radius:8px;padding:16px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;color:#0f172a">${code}</div>
          <p style="color:#94a3b8;font-size:12px;margin-top:16px;text-align:center">This code expires in 10 minutes. Do not share it with anyone.</p>
        </div>
      `,
    });
  } catch (e) { console.error('Failed to send OTP email:', e); }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, phone, purpose = 'LOGIN' } = body;

  if (!email && !phone) return jsonError('Email or phone required', 400);
  if (!['REGISTER', 'LOGIN', 'INVITE'].includes(purpose)) return jsonError('Invalid purpose', 400);

  const rateLimitKey = email || phone || 'unknown';
  if (!checkOtpRateLimit(rateLimitKey)) {
    return jsonError('Too many OTP requests. Please try again later.', 429);
  }

  if (purpose === 'REGISTER' && email) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return jsonError('Please register first before requesting a verification code.', 400);
    }
    if (user.status !== 'PENDING_VERIFICATION') {
      return jsonError('Account does not require verification.', 400);
    }
  }

  if ((purpose === 'LOGIN' || purpose === 'INVITE') && email) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return jsonError('No account found with this email.', 400);
    }
    if (user.status !== 'ACTIVE') {
      return jsonError('Account is not active.', 400);
    }
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  if (email) await prisma.otpCode.deleteMany({ where: { email: email.toLowerCase(), purpose } });
  if (phone) await prisma.otpCode.deleteMany({ where: { phone, purpose } });

  await prisma.otpCode.create({
    data: { email: email?.toLowerCase(), phone, code, purpose, expiresAt },
  });

  const smtpConfig = await prisma.integrationConfig.findFirst({
    where: { type: 'SMTP', isEnabled: true },
  }).catch(() => null);

  let emailSent = false;
  if (email && smtpConfig) {
    const cfg = smtpConfig.config as any;
    if (cfg.host && cfg.username && cfg.password && cfg.fromEmail) {
      await sendEmailOtp(email, code);
      emailSent = true;
    }
  }

  return jsonOk({
    ok: true,
    message: `Verification code sent to ${email || phone}`,
    ...(process.env.NODE_ENV !== 'production' && !emailSent ? { debug_code: code } : {}),
  });
}
