import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as orderService from '../../services/order.service';
import type { OrderStatus } from '../../types';
import { useToast } from '../../stores/toast.store';
import { extractErrorMessage, formatCurrency, formatDateTime } from '../../utils/format';
import { OrderStatusBadge } from '../../components/order/OrderStatusBadge';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Pagination } from '../../components/ui/Pagination';
import { TableRowSkeleton } from '../../components/ui/Skeleton';

const ALL_STATUSES: OrderStatus[] = [
  'PENDING',
  'PAYMENT_PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'PAYMENT_FAILED',
  'REFUNDED',
];

export default function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');

  const ordersQuery = useQuery({
    queryKey: ['admin', 'orders', page, statusFilter],
    queryFn: async () => {
      const res = await orderService.adminGetOrders({
        page,
        size: 15,
        status: statusFilter,
      });
      return res.data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      orderService.adminUpdateOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      toast({ title: 'Order status updated', variant: 'success' });
    },
    onError: (err) => {
      toast({
        title: 'Status update failed',
        description: extractErrorMessage(err),
        variant: 'error',
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500">Manage customer orders and fulfillment states</p>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as OrderStatus | '');
            setPage(0);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          {ALL_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      {ordersQuery.isError ? (
        <ErrorState title="Could not load orders" onRetry={() => ordersQuery.refetch()} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Update Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ordersQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
                ) : (ordersQuery.data?.content ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  (ordersQuery.data?.content ?? []).map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-3">
                        <Link
                          to={`/orders/${order.id}`}
                          className="font-semibold text-primary-600 hover:text-primary-700"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {order.customerEmail || order.shippingFullName || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDateTime(order.createdAt)}</td>
                      <td className="px-4 py-3 text-right">{order.items.length}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(order.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={order.status}
                          disabled={updateStatusMutation.isPending}
                          onChange={(e) =>
                            updateStatusMutation.mutate({
                              id: order.id,
                              status: e.target.value as OrderStatus,
                            })
                          }
                          className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs"
                        >
                          {ALL_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {ordersQuery.data && (
        <Pagination
          pageNumber={ordersQuery.data.pageNumber}
          totalPages={ordersQuery.data.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
