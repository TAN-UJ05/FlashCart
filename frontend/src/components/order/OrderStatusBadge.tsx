import type { OrderStatus } from '../../types';
import { Badge, type BadgeVariant } from '../ui/Badge';

const statusConfig: Record<OrderStatus, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Pending', variant: 'default' },
  PAYMENT_PENDING: { label: 'Payment Pending', variant: 'warning' },
  CONFIRMED: { label: 'Confirmed', variant: 'info' },
  PROCESSING: { label: 'Processing', variant: 'purple' },
  SHIPPED: { label: 'Shipped', variant: 'primary' },
  DELIVERED: { label: 'Delivered', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
  PAYMENT_FAILED: { label: 'Payment Failed', variant: 'danger' },
  REFUNDED: { label: 'Refunded', variant: 'default' },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const cfg = statusConfig[status] ?? { label: status, variant: 'default' as BadgeVariant };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
