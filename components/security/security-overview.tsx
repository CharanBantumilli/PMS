import { Card, CardContent } from '@/components/ui/card';
import { Shield, KeyRound, History } from 'lucide-react';

export function SecurityOverview({ lastLoginAt, activeSessions, auditEvents }: { lastLoginAt: string | null; activeSessions: number; auditEvents: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
