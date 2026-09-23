import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export function StatsCard({
  label,
  value,
  icon: Icon,
  sub,
  trend,
  className,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  sub?: string;
  trend?: { value: number; positive: boolean };
  className?: string;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
        {trend && (
          <div className={cn('mt-1 text-xs font-medium', trend.positive ? 'text-emerald-600' : 'text-red-600')}>
            {trend.positive ? '▲' : '▼'} {Math.abs(trend.value)}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}
