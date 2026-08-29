import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent } from '@/components/ui/card';
import { Globe, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChannelsList } from '@/components/channels/channels-list';
import { ChannelDialog } from '@/components/channels/channel-dialog';

export default async function ChannelsPage() {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const [channels, properties, units] = await Promise.all([
    prisma.channel.findMany({ where: { organizationId: orgId }, include: { mappings: true, _count: { select: { mappings: true, syncLogs: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.property.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.unit.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { number: 'asc' } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Channel management</h1>
          <p className="text-sm text-slate-600">Connect OTAs, sync availability and manage rates across all channels.</p>
        </div>
        <ChannelDialog mode="create" properties={properties.map((p) => ({ id: p.id, name: p.name }))} units={units.map((u) => ({ id: u.id, number: u.number, name: u.name, propertyId: u.propertyId }))} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Active channels</div><div className="mt-1 text-2xl font-bold">{channels.filter((c) => c.status === 'ACTIVE').length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Total mappings</div><div className="mt-1 text-2xl font-bold">{channels.reduce((s, c) => s + c._count.mappings, 0)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Errors (24h)</div><div className="mt-1 text-2xl font-bold text-red-600">{channels.reduce((s, c) => s + c.errorCount, 0)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Last sync</div><div className="mt-1 text-sm font-bold">{channels.length > 0 && channels[0].lastSyncAt ? new Date(channels[0].lastSyncAt).toLocaleString() : 'Never'}</div></CardContent></Card>
      </div>
      {channels.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Globe className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No channels connected</h2>
          <p className="mt-1 text-sm text-slate-600">Connect Booking.com, Airbnb, Expedia and more to sync availability and rates.</p>
        </CardContent></Card>
      ) : (
        <ChannelsList
          channels={channels.map((c) => ({
            id: c.id, name: c.name, type: c.type, status: c.status,
            propertyId: c.propertyId, markup: c.markup, isEnabled: c.isEnabled,
            lastSyncAt: c.lastSyncAt?.toISOString() || null, lastSyncStatus: c.lastSyncStatus,
            errorCount: c.errorCount, mappingCount: c._count.mappings,
          }))}
          properties={properties.map((p) => ({ id: p.id, name: p.name }))}
          units={units.map((u) => ({ id: u.id, number: u.number, name: u.name, propertyId: u.propertyId }))}
        />
      )}
    </div>
  );
}
