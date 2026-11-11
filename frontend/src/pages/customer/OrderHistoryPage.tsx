import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import * as orderService from '../../services/order.service';
import { useAuth } from '../../stores/auth.store';
import { OrderCard } from '../../components/order/OrderCard';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';

export default function OrderHistoryPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(0);

  const ordersQuery = useQuery({
    queryKey: ['orders', user?.id ?? 'anon', page],
    queryFn: async () => {
      const res = await orderService.getOrders({ page, size: 10 });
      return res.data;
    },
    enabled: !!user?.id,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track status, view invoices, or manage active orders
        </p>
      </div>

      {ordersQuery.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : ordersQuery.isError ? (
        <ErrorState
          title="Could not load orders"
          onRetry={() => ordersQuery.refetch()}
        />
      ) : !ordersQuery.data || ordersQuery.data.content.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="No orders yet"
          description="Once you place an order, it will appear here."
          action={
            <Link to="/products">
              <Button>Explore Products</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="space-y-4">
            {ordersQuery.data.content.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
          <Pagination
            pageNumber={ordersQuery.data.pageNumber}
            totalPages={ordersQuery.data.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
