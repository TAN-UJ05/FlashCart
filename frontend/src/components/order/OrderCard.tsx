import { Link } from 'react-router-dom';
import { ChevronRight, Package } from 'lucide-react';
import type { Order } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { OrderStatusBadge } from './OrderStatusBadge';

export function OrderCard({ order }: { order: Order }) {
  const itemCount = order.items.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <Link
      to={`/orders/${order.id}`}
      data-testid="order-item"
      className="block rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{order.orderNumber}</p>
            <p className="text-xs text-gray-500">Placed on {formatDateTime(order.createdAt)}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <OrderStatusBadge status={order.status} />
          <div className="text-right">
            <p className="text-base font-bold text-gray-900">
              {formatCurrency(order.totalAmount)}
            </p>
            <p className="text-xs text-gray-500">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>
      </div>
    </Link>
  );
}
