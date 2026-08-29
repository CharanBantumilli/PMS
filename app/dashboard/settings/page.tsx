import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { OrganizationForm } from '@/components/settings/organization-form';
import { BillingPanel } from '@/components/settings/billing-panel';
import { formatDate } from '@/lib/utils';

export default async function SettingsPage() {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return null;
  const [unitCount, propertyCount, userCount] = await Promise.all([
    prisma.unit.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.property.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.user.count({ where: { organizationId: orgId } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600">Workspace, billing and brand preferences.</p>
      </div>
      <Tabs defaultValue="organization">
        <TabsList>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="billing">Plan &amp; Billing</TabsTrigger>
        </TabsList>
        <TabsContent value="organization">
          <Card>
            <CardHeader><CardTitle>Organization details</CardTitle></CardHeader>
            <CardContent>
              <OrganizationForm initial={{
                id: org.id, name: org.name, legalName: org.legalName, taxId: org.taxId,
                email: org.email, phone: org.phone, website: org.website,
                addressLine1: org.addressLine1, addressLine2: org.addressLine2,
                city: org.city, state: org.state, postalCode: org.postalCode, country: org.country,
                currency: org.currency, timezone: org.timezone, locale: org.locale,
                checkInTime: org.checkInTime, checkOutTime: org.checkOutTime,
                brandName: org.brandName, primaryColor: org.primaryColor,
              }} usage={{ units: unitCount, properties: propertyCount, users: userCount, maxUnits: org.maxUnits, maxProperties: org.maxProperties, maxUsers: org.maxUsers }} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="billing">
          <Card>
            <CardHeader><CardTitle>Plan &amp; billing</CardTitle></CardHeader>
            <CardContent>
              <BillingPanel plan={org.plan} planStatus={org.planStatus} trialEndsAt={org.trialEndsAt?.toISOString() || null} currentPeriodEnd={org.currentPeriodEnd?.toISOString() || null} stripeCustomerId={org.stripeCustomerId} currency={org.currency} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
