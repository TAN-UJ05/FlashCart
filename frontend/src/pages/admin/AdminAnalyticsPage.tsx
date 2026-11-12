import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import * as analyticsService from '../../services/analytics.service';
import { formatCurrency } from '../../utils/format';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';

const RANGE_OPTIONS = [
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
];

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);

  const analyticsQuery = useQuery({
    queryKey: ['admin', 'analytics', 'dashboard', days],
    queryFn: async () => {
      const res = await analyticsService.getDashboardAnalytics(days);
      return res.data;
    },
  });

  if (analyticsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (analyticsQuery.isError || !analyticsQuery.data) {
    return (
      <ErrorState
        title="Could not load analytics"
        onRetry={() => analyticsQuery.refetch()}
      />
    );
  }

  const data = analyticsQuery.data;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            Performance
          </span>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">
            Analytics &amp; Insights
          </h1>
          <p className="text-sm text-slate-500">
            Period revenue, order volume, top products, and stock health
          </p>
        </div>

        <div className="flex gap-2">
          {RANGE_OPTIONS.map((opt) => (
            <Button
              key={opt.days}
              size="sm"
              variant={days === opt.days ? 'primary' : 'outline'}
              onClick={() => setDays(opt.days)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Period Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Period Revenue ({days}d)
            </p>
            <p className="mt-1.5 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {formatCurrency(data.periodRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Period Orders ({days}d)
            </p>
            <p className="mt-1.5 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {data.periodOrders}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Confirmed Orders
            </p>
            <p className="mt-1.5 font-display text-2xl font-bold text-emerald-600 tabular-nums">
              {data.confirmedOrders}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Low Stock Alerts
            </p>
            <p className="mt-1.5 font-display text-2xl font-bold text-rose-600 tabular-nums">
              {data.lowStockCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenueByDay ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip formatter={(val) => formatCurrency(Number(val ?? 0))} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Volume</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.revenueByDay ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip />
                <Bar dataKey="orders" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Selling Products (by Units Sold)</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          {!data.topProducts || data.topProducts.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              No sales data available for this period yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topProducts} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis
                  type="category"
                  dataKey="productName"
                  width={150}
                  tick={{ fontSize: 12, fill: '#334155' }}
                />
                <Tooltip />
                <Bar dataKey="unitsSold" fill="#f59e0b" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
