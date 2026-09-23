import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ApiKeysList } from '@/components/integrations/api-keys-list';
import { IntegrationsGrid } from '@/components/integrations/integrations-grid';
import { Plus, Key, Plug, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiKeyDialog } from '@/components/integrations/api-key-dialog';
import Link from 'next/link';

export default async function IntegrationsPage() {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const [apiKeys, integrations] = await Promise.all([
    prisma.apiKey.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' } }),
    prisma.integrationConfig.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Integrations</h1>
        <p className="text-sm text-slate-600">Connect external services and manage API keys.</p>
      </div>
      <Tabs defaultValue="apps">
        <TabsList>
          <TabsTrigger value="apps"><Plug className="h-3.5 w-3.5 mr-1" /> Apps</TabsTrigger>
          <TabsTrigger value="api"><Key className="h-3.5 w-3.5 mr-1" /> API Keys</TabsTrigger>
          <TabsTrigger value="docs"><BookOpen className="h-3.5 w-3.5 mr-1" /> API Docs</TabsTrigger>
        </TabsList>

        <TabsContent value="apps">
          <IntegrationsGrid
            integrations={integrations.map((i) => ({ id: i.id, type: i.type, name: i.name, isEnabled: i.isEnabled, lastSyncAt: i.lastSyncAt?.toISOString() || null, errorMessage: i.errorMessage, config: (i.config as Record<string, unknown>) || {} }))}
          />
        </TabsContent>

        <TabsContent value="api">
          <div className="space-y-3">
            <div className="flex justify-end"><ApiKeyDialog mode="create" /></div>
            <ApiKeysList
              keys={apiKeys.map((k) => ({
                id: k.id, name: k.name, prefix: k.prefix, scopes: k.scopes,
                lastUsedAt: k.lastUsedAt?.toISOString() || null, expiresAt: k.expiresAt?.toISOString() || null,
                isActive: k.isActive, createdAt: k.createdAt.toISOString(),
              }))}
            />
          </div>
        </TabsContent>

        <TabsContent value="docs">
          <Card>
            <CardHeader><CardTitle>REST API</CardTitle></CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p className="text-sm text-slate-600">Use API keys to authenticate requests to the PMS REST API. All endpoints are scoped to your organization.</p>
              <pre className="mt-4 overflow-x-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
{`# Base URL
${process.env.APP_URL || 'https://your-domain.com'}/api/v1

# Authentication
Authorization: Bearer pms_live_xxxxxxxxxxxx

# List bookings
curl -H "Authorization: Bearer pms_live_xxx" \\
  ${process.env.APP_URL || 'https://your-domain.com'}/api/v1/bookings

# Create a booking
curl -X POST -H "Authorization: Bearer pms_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"propertyId":"...","guestId":"...","arrivalDate":"2026-09-01","departureDate":"2026-09-03"}' \\
  ${process.env.APP_URL || 'https://your-domain.com'}/api/v1/bookings

booking.created   booking.updated   booking.confirmed
booking.checked_in  booking.checked_out  booking.canceled
payment.received  invoice.created  guest.created`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
