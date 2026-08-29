import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SecurityOverview } from '@/components/security/security-overview';
import { SessionsList } from '@/components/security/sessions-list';
import { AuditLog } from '@/components/security/audit-log';
import { TwoFactorPanel } from '@/components/security/two-factor-panel';
import { Shield, Smartphone, History, KeyRound } from 'lucide-react';

export default async function SecurityPage() {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const userId = session!.user.id;

  const [activities, userSessions, twoFactor, user] = await Promise.all([
    prisma.activityLog.findMany({ where: { organizationId: orgId }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.userSession.findMany({ where: { userId, organizationId: orgId }, orderBy: { lastActiveAt: 'desc' }, take: 20 }),
    prisma.twoFactorSecret.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { lastLoginAt: true, email: true, name: true } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Security &amp; controls</h1>
        <p className="text-sm text-slate-600">Two-factor authentication, active sessions and full audit log.</p>
      </div>
      <SecurityOverview
        twoFactorEnabled={!!twoFactor?.isEnabled}
        lastLoginAt={user?.lastLoginAt?.toISOString() || null}
        activeSessions={userSessions.filter((s) => s.isActive).length}
        auditEvents={activities.length}
      />
      <Tabs defaultValue="2fa">
        <TabsList>
          <TabsTrigger value="2fa"><Smartphone className="h-3.5 w-3.5 mr-1" /> Two-factor</TabsTrigger>
          <TabsTrigger value="sessions"><KeyRound className="h-3.5 w-3.5 mr-1" /> Sessions</TabsTrigger>
          <TabsTrigger value="audit"><History className="h-3.5 w-3.5 mr-1" /> Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="2fa">
          <Card>
            <CardHeader><CardTitle>Two-factor authentication</CardTitle></CardHeader>
            <CardContent>
              <TwoFactorPanel
                enabled={!!twoFactor?.isEnabled}
                configured={!!twoFactor}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="sessions">
          <Card>
            <CardHeader><CardTitle>Active sessions</CardTitle></CardHeader>
            <CardContent>
              <SessionsList
                sessions={userSessions.map((s) => ({
                  id: s.id, ipAddress: s.ipAddress, userAgent: s.userAgent,
                  device: s.device, location: s.location, isActive: s.isActive,
                  lastActiveAt: s.lastActiveAt.toISOString(), createdAt: s.createdAt.toISOString(),
                }))}
                currentSessionId={null}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="audit">
          <Card>
            <CardHeader><CardTitle>Audit log</CardTitle></CardHeader>
            <CardContent>
              <AuditLog
                activities={activities.map((a) => ({
                  id: a.id, action: a.action, entity: a.entity, entityId: a.entityId,
                  description: a.description, user: a.user ? { name: a.user.name, email: a.user.email } : null,
                  createdAt: a.createdAt.toISOString(),
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
