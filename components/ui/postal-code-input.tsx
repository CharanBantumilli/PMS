'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import pincodeData from '@/data/pincodes.json';

type PostalCodeStatus = 'idle' | 'loading' | 'found' | 'invalid';

interface PostalCodeInputProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  onFound?: (data: { city: string; state: string; country: string }) => void;
  onChange?: (value: string) => void;
}

export function PostalCodeInput({
  id = 'postalCode',
  name = 'postalCode',
  value: controlledValue,
  defaultValue,
  required,
  placeholder = 'e.g. 110001',
  onFound,
  onChange,
}: PostalCodeInputProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  const value = controlledValue !== undefined ? controlledValue : internalValue;
  const [status, setStatus] = useState<PostalCodeStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  const lookup = useCallback((code: string) => {
    const clean = code.replace(/\s/g, '');
    if (clean.length < 6) { setStatus('idle'); return; }
    const match = (pincodeData as Record<string, { s: string; d: string }>)[clean];
    if (match) {
      setStatus('found');
      onFound?.({ city: match.d, state: match.s, country: 'IN' });
      toast.success(`Location: ${match.d}, ${match.s}`);
    } else {
      setStatus('invalid');
    }
  }, [onFound]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (controlledValue !== undefined) onChange?.(val);
    else setInternalValue(val);
    setStatus('idle');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => lookup(val), 500);
  }

  const statusIcon = status === 'found'
    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
    : status === 'invalid'
    ? <AlertCircle className="h-3.5 w-3.5 text-red-500" />
    : null;

  return (
    <div>
      <Label htmlFor={id}>
        Postal code {statusIcon && <span className="ml-1 inline-flex">{statusIcon}</span>}
      </Label>
      <Input
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        required={required}
        placeholder={placeholder}
        maxLength={6}
      />
      {status === 'invalid' && (
        <p className="mt-1 text-xs text-red-500">Invalid postal code</p>
      )}
    </div>
  );
}
