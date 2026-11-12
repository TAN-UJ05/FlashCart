import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { IndianRupee, ShoppingBag, Users, Package, AlertTriangle } from 'lucide-react';
import * as analyticsService from '../../services/analytics.service';
import * as orderService from '../../services/order.service';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { OrderStatusBadge } from '../../components/order/OrderStatusBadge';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';

const PIE_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#e11d48', '#8b5cf6', '#64748b'];

export default function AdminDashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ['admin', 'analytics', 'dashboard', 30],
    queryFn: async () => {
      const res = await analyticsService.getDashboardAnalytics(30);
      return res.data;
    },
  });

  const recentOrdersQuery = useQuery({
    queryKey: ['admin', 'orders', 'recent'],
    queryFn: async () => {
      const res = await orderService.adminGetOrders({ page: 0, size: 5 });
      return res.data.content;
    },
  });

  if (dashboardQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <ErrorState
        title="Could not load dashboard metrics"
        onRetry={() => dashboardQuery.refetch()}
      />
    );
  }

  const stats = dashboardQuery.data;
  const orderStatusData = Object.entries(stats.ordersByStatus ?? {})
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({
      name,
      value,
    }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            Executive Overview
          </span>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">
            Store Overview
          </h1>
          <p className="text-sm text-slate-500">
            Live revenue, order pipeline, and catalog stock status
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft">
          <CardContent className="flex items-center justify-between gap-3 pt-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Revenue
              </p>
              <p className="mt-1.5 font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatCurrency(stats.totalRevenue)}
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <IndianRupee className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft">
          <CardContent className="flex items-center justify-between gap-3 pt-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Orders
              </p>
              <p className="mt-1.5 font-display text-xl xl:text-2xl font-bold text-slate-900 tabular-nums">
                {stats.totalOrders}
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft">
          <CardContent className="flex items-center justify-between gap-3 pt-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Customers
              </p>
              <p className="mt-1.5 font-display text-xl xl:text-2xl font-bold text-slate-900 tabular-nums">
                {stats.totalCustomers}
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft">
          <CardContent className="flex items-center justify-between gap-3 pt-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Products
              </p>
              <p className="mt-1.5 font-display text-xl xl:text-2xl font-bold text-slate-900 tabular-nums">
                {stats.totalProducts}
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue Over Time (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.revenueByDay ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val) => formatCurrency(Number(val ?? 0))}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders by Status</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {orderStatusData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No order data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={orderStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="44%"
                    innerRadius={32}
                    outerRadius={54}
                    paddingAngle={2}
                    isAnimationActive={false}
                    labelLine={false}
                    label={({ x, y, name, value, textAnchor }) => (
                      <text
                        x={x}
                        y={y}
                        fill="#334155"
                        fontSize={10}
                        fontWeight={600}
                        textAnchor={textAnchor}
                        dominantBaseline="central"
                      >
                        {`${name}: ${value}`}
                      </text>
                    )}
                  >
                    {orderStatusData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low Stock & Recent Orders */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Low Stock Alerts
            </CardTitle>
            <Link
              to="/admin/inventory"
              className="text-xs font-semibold text-primary-600 transition-colors hover:text-primary-700"
            >
              Manage Inventory →
            </Link>
          </CardHeader>
          <CardContent>
            {!stats.lowStockItems || stats.lowStockItems.length === 0 ? (
              <p className="text-sm text-slate-500">All products are sufficiently stocked.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {stats.lowStockItems.slice(0, 6).map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{item.productName}</p>
                      <p className="font-mono text-xs text-slate-500">SKU: {item.productSku}</p>
                    </div>
                    <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 tabular-nums">
                      {item.availableStock} left
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Orders</CardTitle>
            <Link
              to="/admin/orders"
              className="text-xs font-semibold text-primary-600 transition-colors hover:text-primary-700"
            >
              View All →
            </Link>
          </CardHeader>
          <CardContent>
            {recentOrdersQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !recentOrdersQuery.data || recentOrdersQuery.data.length === 0 ? (
              <p className="text-sm text-slate-500">No orders placed yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentOrdersQuery.data.map((order) => (
                  <div key={order.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <Link
                        to={`/orders/${order.id}`}
                        className="font-semibold text-slate-900 transition-colors hover:text-primary-600"
                      >
                        {order.orderNumber}
                      </Link>
                      <p className="text-xs text-slate-500">{formatDateTime(order.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <OrderStatusBadge status={order.status} />
                      <span className="font-semibold tabular-nums text-slate-900">
                        {formatCurrency(order.totalAmount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
