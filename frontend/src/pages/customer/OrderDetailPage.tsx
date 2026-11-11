import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CreditCard, MapPin, XCircle } from 'lucide-react';
import * as orderService from '../../services/order.service';
import * as paymentService from '../../services/payment.service';
import { useAuth } from '../../stores/auth.store';
import { useToast } from '../../stores/toast.store';
import { extractErrorMessage, formatCurrency, formatDateTime } from '../../utils/format';
import { OrderStatusBadge } from '../../components/order/OrderStatusBadge';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const orderQuery = useQuery({
    queryKey: ['order', user?.id ?? 'anon', id],
    queryFn: async () => {
      const res = await orderService.getOrder(id!);
      return res.data;
    },
    enabled: !!id && !!user?.id,
  });

  const paymentsQuery = useQuery({
    queryKey: ['payments', 'order', user?.id ?? 'anon', id],
    queryFn: async () => {
      const res = await paymentService.getPaymentsForOrder(id!);
      return res.data;
    },
    enabled: !!id && !!user?.id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => orderService.cancelOrder(id!),
    onSuccess: () => {
      setConfirmCancelOpen(false);
      queryClient.invalidateQueries({ queryKey: ['order', user?.id ?? 'anon', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      toast({
        title: 'Order cancelled',
        description: 'Reserved stock has been released back to inventory.',
        variant: 'info',
      });
    },
    onError: (err) => {
      toast({
        title: 'Could not cancel order',
        description: extractErrorMessage(err),
        variant: 'error',
      });
    },
  });

  if (orderQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorState
          title="Order not found"
          onRetry={() => orderQuery.refetch()}
        />
      </div>
    );
  }

  const order = orderQuery.data;
  const latestPayment = paymentsQuery.data?.[0];
  const isOwner = !!user && (!order.userId || order.userId === user.id);
  const canPay =
    isOwner &&
    (order.status === 'PENDING' ||
      order.status === 'PAYMENT_PENDING' ||
      order.status === 'PAYMENT_FAILED');
  const canCancel =
    order.status === 'PENDING' ||
    order.status === 'PAYMENT_PENDING' ||
    order.status === 'PAYMENT_FAILED' ||
    (isAdmin && (order.status === 'CONFIRMED' || order.status === 'PROCESSING'));
  const backTarget = isAdmin && !isOwner ? '/admin/orders' : '/orders';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <Link
        to={backTarget}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Placed on {formatDateTime(order.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {canPay && (
            <Button
              onClick={() => navigate(`/payment-result?orderId=${order.id}`)}
            >
              <CreditCard className="h-4 w-4" />
              Complete Payment
            </Button>
          )}
          {canCancel && (
            <Button
              variant="danger"
              onClick={() => setConfirmCancelOpen(true)}
            >
              <XCircle className="h-4 w-4" />
              Cancel Order
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="pb-3">Product</th>
                    <th className="pb-3 text-right">Price</th>
                    <th className="pb-3 text-right">Qty</th>
                    <th className="pb-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3">
                        <p className="font-medium text-gray-900">{item.productName}</p>
                        <p className="text-xs text-gray-500">SKU: {item.productSku}</p>
                      </td>
                      <td className="py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-3 text-right">{item.quantity}</td>
                      <td className="py-3 text-right font-semibold">
                        {formatCurrency(item.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-2 border-t border-gray-200 pt-4 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(order.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-gray-900">
                <span>Total</span>
                <span>{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-primary-600" />
                Shipping Address
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-1">
              <p className="font-semibold text-gray-900">{order.shippingFullName || '-'}</p>
              <p>{order.shippingAddressLine1}</p>
              {order.shippingAddressLine2 && <p>{order.shippingAddressLine2}</p>}
              <p>
                {order.shippingCity}, {order.shippingState} {order.shippingPostalCode}
              </p>
              <p>{order.shippingCountry}</p>
              {order.shippingPhone && <p>Phone: {order.shippingPhone}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4 text-primary-600" />
                Payment Status
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {latestPayment ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Status</span>
                    <Badge
                      variant={
                        latestPayment.status === 'SUCCEEDED'
                          ? 'success'
                          : latestPayment.status === 'FAILED'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {latestPayment.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Amount</span>
                    <span className="font-semibold">{formatCurrency(latestPayment.amount)}</span>
                  </div>
                  {latestPayment.transactionId && (
                    <div className="text-xs text-gray-500">
                      Txn: <span className="font-mono">{latestPayment.transactionId}</span>
                    </div>
                  )}
                  {latestPayment.failureReason && (
                    <p className="text-xs text-red-600">{latestPayment.failureReason}</p>
                  )}
                </>
              ) : (
                <p className="text-gray-500">No payment initiated yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        onConfirm={() => cancelMutation.mutate()}
        title="Cancel Order?"
        message="Are you sure you want to cancel this order? Any reserved stock will be released."
        confirmText="Yes, Cancel Order"
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
}
