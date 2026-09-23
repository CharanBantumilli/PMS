'use client';

import * as React from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { formatCurrency } from '@/lib/utils';

type ChartDataPoint = { date: string; revenue: number; bookings: number };

interface ReportsLineChartProps {
  data: ChartDataPoint[];
  currency: string;
  title?: string;
  description?: string;
}

const chartConfig = {
  views: { label: 'Page Views' },
  revenue: { label: 'Revenue', color: 'hsl(142, 76%, 36%)' },
  bookings: { label: 'Bookings', color: 'hsl(221, 83%, 53%)' },
} satisfies ChartConfig;

export function ReportsLineChart({
  data,
  currency,
  title = 'Trends',
  description = 'Revenue and bookings over time',
}: ReportsLineChartProps) {
  const [activeChart, setActiveChart] = React.useState<'revenue' | 'bookings'>('revenue');

  const total = React.useMemo(
    () => ({
      revenue: data.reduce((acc, curr) => acc + curr.revenue, 0),
      bookings: data.reduce((acc, curr) => acc + curr.bookings, 0),
    }),
    [data]
  );

  return (
    <Card className="py-4 sm:py-0">
      <CardHeader className="flex flex-col items-stretch border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 sm:pb-0">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex">
          {(['revenue', 'bookings'] as const).map((key) => {
            return (
              <button
                key={key}
                data-active={activeChart === key}
                className="flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
                onClick={() => setActiveChart(key)}
              >
                <span className="text-xs text-muted-foreground">
                  {chartConfig[key].label}
                </span>
                <span className="text-lg leading-none font-bold sm:text-3xl">
                  {key === 'revenue'
                    ? formatCurrency(total.revenue, currency)
                    : total.bookings.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <LineChart
            data={data}
            margin={{ left: 12, right: 12 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => {
                if (activeChart === 'revenue') {
                  if (value >= 10000) return `${(value / 1000).toFixed(0)}k`;
                  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
                  return `${value}`;
                }
                return `${value}`;
              }}
              width={activeChart === 'revenue' ? 50 : 30}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[150px]"
                  nameKey="views"
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });
                  }}
                  formatter={(value, name) =>
                    name === 'revenue' ? formatCurrency(Number(value), currency) : String(value)
                  }
                />
              }
            />
            <Line
              dataKey={activeChart}
              type="monotone"
              stroke={`var(--color-${activeChart})`}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
