import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { SignOutButton } from '@/components/dashboard/sign-out-button';

export const metadata = { title: 'No access' };

export default function NoAccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Access restricted</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your role doesn&apos;t have permission to open this section. Ask your workspace owner if you need access.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Back to dashboard
          </Link>
          <SignOutButton className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" />
        </div>
      </div>
    </div>
  );
}
