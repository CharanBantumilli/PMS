import { PropertyForm } from '@/components/properties/property-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function NewPropertyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="text-sm text-slate-500">
        <Link href="/dashboard/properties" className="hover:text-slate-900">← Back to properties</Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New property</CardTitle>
        </CardHeader>
        <CardContent>
          <PropertyForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
