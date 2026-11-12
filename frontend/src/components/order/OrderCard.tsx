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
      className="group block rounded-2xl border border-slate-200/85 bg-white p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-elevated"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-600 group-hover:text-white">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-sm font-bold text-slate-900">{order.orderNumber}</p>
            <p className="text-xs text-slate-500">Placed on {formatDateTime(order.createdAt)}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <OrderStatusBadge status={order.status} />
          <div className="text-right tabular-nums">
            <p className="text-base font-extrabold text-slate-900">
              {formatCurrency(order.totalAmount)}
            </p>
            <p className="text-xs text-slate-500">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-600" />
        </div>
      </div>
    </Link>
  );
}
