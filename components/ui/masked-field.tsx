'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const masked = local.length <= 2 ? '*'.repeat(local.length) : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  return `${masked}@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '*'.repeat(digits.length);
  const lastFour = digits.slice(-4);
  const prefix = phone.startsWith('+') ? phone.slice(0, phone.length - digits.length) : '';
  return `${prefix}${'*'.repeat(digits.length - 4)}${lastFour}`;
}

function maskIdNumber(idNumber: string): string {
  if (idNumber.length <= 4) return '*'.repeat(idNumber.length);
  return '*'.repeat(idNumber.length - 4) + idNumber.slice(-4);
}

function getMaskedValue(value: string, type: 'email' | 'phone' | 'id'): string {
  switch (type) {
    case 'email': return maskEmail(value);
    case 'phone': return maskPhone(value);
    case 'id': return maskIdNumber(value);
    default: return value;
  }
}

interface MaskedFieldProps {
  value: string | null | undefined;
  type?: 'email' | 'phone' | 'id';
  className?: string;
}

export function MaskedField({ value, type = 'email', className }: MaskedFieldProps) {
  const [revealed, setRevealed] = useState(false);

  if (!value) return <span className={cn('text-slate-400', className)}>—</span>;

  const masked = getMaskedValue(value, type);

  return (
    <span
      className={cn(
        'inline-block cursor-default rounded px-1 -mx-1 transition-all duration-200',
        revealed
          ? 'bg-slate-100 text-slate-900'
          : 'text-slate-600 hover:bg-slate-50',
        className
      )}
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => setRevealed(false)}
    >
      {revealed ? value : masked}
    </span>
  );
}
