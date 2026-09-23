'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const COUNTRIES = [
  { code: '+91', iso: 'IN', label: 'India', flag: '\u{1F1EE}\u{1F1F3}', example: '98765 43210' },
  { code: '+1', iso: 'US', label: 'United States', flag: '\u{1F1FA}\u{1F1F8}', example: '415 555 2671' },
  { code: '+44', iso: 'GB', label: 'United Kingdom', flag: '\u{1F1EC}\u{1F1E7}', example: '7911 123456' },
  { code: '+61', iso: 'AU', label: 'Australia', flag: '\u{1F1E6}\u{1F1FA}', example: '412 345 678' },
  { code: '+971', iso: 'AE', label: 'UAE', flag: '\u{1F1E6}\u{1F1EA}', example: '50 123 4567' },
  { code: '+65', iso: 'SG', label: 'Singapore', flag: '\u{1F1F8}\u{1F1EC}', example: '9123 4567' },
  { code: '+60', iso: 'MY', label: 'Malaysia', flag: '\u{1F1F2}\u{1F1FE}', example: '12 345 6789' },
  { code: '+66', iso: 'TH', label: 'Thailand', flag: '\u{1F1F9}\u{1F1ED}', example: '81 234 5678' },
  { code: '+62', iso: 'ID', label: 'Indonesia', flag: '\u{1F1EE}\u{1F1E9}', example: '812 3456 7890' },
  { code: '+63', iso: 'PH', label: 'Philippines', flag: '\u{1F1F5}\u{1F1ED}', example: '917 123 4567' },
  { code: '+86', iso: 'CN', label: 'China', flag: '\u{1F1E8}\u{1F1F3}', example: '138 0013 8000' },
  { code: '+81', iso: 'JP', label: 'Japan', flag: '\u{1F1EF}\u{1F1F5}', example: '90 1234 5678' },
  { code: '+82', iso: 'KR', label: 'South Korea', flag: '\u{1F1F0}\u{1F1F7}', example: '10 1234 5678' },
  { code: '+49', iso: 'DE', label: 'Germany', flag: '\u{1F1E9}\u{1F1EA}', example: '151 1234567' },
  { code: '+33', iso: 'FR', label: 'France', flag: '\u{1F1EB}\u{1F1F7}', example: '6 12 34 56 78' },
  { code: '+39', iso: 'IT', label: 'Italy', flag: '\u{1F1EE}\u{1F1F9}', example: '312 123 4567' },
  { code: '+34', iso: 'ES', label: 'Spain', flag: '\u{1F1EA}\u{1F1F8}', example: '612 345 678' },
  { code: '+31', iso: 'NL', label: 'Netherlands', flag: '\u{1F1F3}\u{1F1F1}', example: '6 12345678' },
  { code: '+41', iso: 'CH', label: 'Switzerland', flag: '\u{1F1E8}\u{1F1ED}', example: '79 123 45 67' },
  { code: '+46', iso: 'SE', label: 'Sweden', flag: '\u{1F1F8}\u{1F1EA}', example: '70 123 45 67' },
  { code: '+1', iso: 'CA', label: 'Canada', flag: '\u{1F1E8}\u{1F1E6}', example: '416 555 1234' },
  { code: '+55', iso: 'BR', label: 'Brazil', flag: '\u{1F1E7}\u{1F1F7}', example: '11 91234 5678' },
  { code: '+27', iso: 'ZA', label: 'South Africa', flag: '\u{1F1FF}\u{1F1E6}', example: '82 123 4567' },
  { code: '+966', iso: 'SA', label: 'Saudi Arabia', flag: '\u{1F1F8}\u{1F1E6}', example: '50 123 4567' },
  { code: '+977', iso: 'NP', label: 'Nepal', flag: '\u{1F1F3}\u{1F1F5}', example: '984 123 4567' },
  { code: '+94', iso: 'LK', label: 'Sri Lanka', flag: '\u{1F1F1}\u{1F1F0}', example: '71 234 5678' },
  { code: '+880', iso: 'BD', label: 'Bangladesh', flag: '\u{1F1E7}\u{1F1E9}', example: '171 234 5678' },
];

type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: string;
  required?: boolean;
  id?: string;
  name?: string;
  placeholder?: string;
  className?: string;
};

function formatDigits(digits: string): string {
  const clean = digits.replace(/\D/g, '');
  if (clean.length <= 5) return clean;
  return `${clean.slice(0, 5)} ${clean.slice(5, 10)}`;
}

export function PhoneInput({ value, onChange, defaultCountry = 'IN', required, id, name, placeholder, className }: PhoneInputProps) {
  const [country, setCountry] = useState(() => COUNTRIES.find((c) => c.iso === defaultCountry) || COUNTRIES[0]);

  useEffect(() => {
    if (value && value.startsWith('+')) {
      const match = COUNTRIES.find((c) => value.startsWith(c.code));
      if (match) setCountry(match);
    }
  }, []);

  const matchedCountry = COUNTRIES.find((c) => value.startsWith(c.code));
  const rawDigits = matchedCountry ? value.slice(matchedCountry.code.length).replace(/\D/g, '') : '';
  const displayDigits = formatDigits(rawDigits);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '');
    onChange(`${country.code}${digits}`);
  }

  function handleCountryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newCountry = COUNTRIES.find((c) => c.iso === e.target.value);
    if (newCountry) {
      setCountry(newCountry);
      onChange(`${newCountry.code}${rawDigits}`);
    }
  }

  return (
    <div className={cn('flex h-10 min-w-0 rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2', className)}>
      <select
        value={country.iso}
        onChange={handleCountryChange}
        className="rounded-l-md border-0 border-r border-input bg-transparent px-2 py-2 text-sm text-slate-700 focus:outline-none"
      >
        {COUNTRIES.map((c) => (
          <option key={c.iso} value={c.iso}>{c.flag} {c.code}</option>
        ))}
      </select>
      <input
        id={id}
        name={name}
        required={required}
        value={displayDigits}
        onChange={handleChange}
        placeholder={placeholder || country.example}
        className="flex-1 rounded-r-md border-0 bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
      />
    </div>
  );
}

export function parsePhone(fullPhone: string): { country: string; number: string } {
  for (const c of COUNTRIES) {
    if (fullPhone.startsWith(c.code)) {
      return { country: c.iso, number: fullPhone.slice(c.code.length) };
    }
  }
  return { country: '', number: fullPhone.replace(/\D/g, '') };
}
