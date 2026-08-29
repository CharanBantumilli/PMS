import { Card, CardContent } from '@/components/ui/card';
import { Shield, Smartphone, KeyRound, History } from 'lucide-react';

export function SecurityOverview({ twoFactorEnabled, lastLoginAt, activeSessions, auditEvents }: { twoFactorEnabled: boolean; lastLoginAt: string | null; activeSessions: number; auditEvents: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Card><CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase text-slate-500">2FA</span>
          <Smartphone className={`h-4 w-4 ${twoFactorEnabled ? 'text-emerald-600' : 'text-slate-400'}`} />
        </div>
        <div className="mt-1 text-lg font-bold">{twoFactorEnabled ? 'Enabled' : 'Disabled'}</div>
      </CardContent></Card>
      <Card><CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase text-slate-500">Active sessions</span>
          <KeyRound className="h-4 w-4 text-slate-500" />
        </div>
        <div className="mt-1 text-lg font-bold">{activeSessions}</div>
      </CardContent></Card>
      <Card><CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase text-slate-500">Last login</span>
          <Shield className="h-4 w-4 text-slate-500" />
        </div>
        <div className="mt-1 text-sm font-medium">{lastLoginAt ? new Date(lastLoginAt).toLocaleString() : 'Never'}</div>
      </CardContent></Card>
      <Card><CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase text-slate-500">Audit events</span>
          <History className="h-4 w-4 text-slate-500" />
        </div>
        <div className="mt-1 text-lg font-bold">{auditEvents}</div>
      </CardContent></Card>
    </div>
  );
}
