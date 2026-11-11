import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Clock, CreditCard, RefreshCw } from 'lucide-react';
import * as orderService from '../../services/order.service';
import * as paymentService from '../../services/payment.service';
import { useToast } from '../../stores/toast.store';
import { extractErrorMessage, formatCurrency, generateIdempotencyKey } from '../../utils/format';
import { OrderStatusBadge } from '../../components/order/OrderStatusBadge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') ?? '';
  const paymentIdParam = searchParams.get('paymentId') ?? '';
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activePaymentId, setActivePaymentId] = useState(paymentIdParam);

  const orderQuery = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const res = await orderService.getOrder(orderId);
      return res.data;
    },
    enabled: !!orderId,
  });

  const paymentsQuery = useQuery({
    queryKey: ['payments', 'order', orderId],
    queryFn: async () => {
      const res = await paymentService.getPaymentsForOrder(orderId);
      return res.data;
    },
    enabled: !!orderId,
  });

  const initiateMutation = useMutation({
    mutationFn: async () => {
      const res = await paymentService.initiatePayment(
        orderId,
        generateIdempotencyKey(`pay-${orderId}`)
      );
      return res.data;
    },
    onSuccess: (payment) => {
      setActivePaymentId(payment.id);
      queryClient.invalidateQueries({ queryKey: ['payments', 'order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    },
    onError: (err) => {
      toast({
        title: 'Could not initiate payment',
        description: extractErrorMessage(err),
        variant: 'error',
      });
    },
  });

  const resolvedPaymentId = activePaymentId || paymentsQuery.data?.[0]?.id || '';

  const simulateMutation = useMutation({
    mutationFn: async (outcome: 'SUCCEEDED' | 'FAILED' | 'TIMEOUT') => {
      let pid = resolvedPaymentId;
      if (!pid) {
        const initRes = await paymentService.initiatePayment(orderId, orderId);
        pid = initRes.data.id;
        setActivePaymentId(pid);
      }
      const res = await paymentService.simulatePayment({
        paymentId: pid,
        transactionId: `SIM-${Date.now()}`,
        outcome,
        failureReason:
          outcome === 'FAILED'
            ? 'Card declined by issuer (simulated)'
            : outcome === 'TIMEOUT'
              ? 'Payment gateway timeout (simulated)'
              : undefined,
      });
      return res.data;
    },
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['payments', 'order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({
        title: `Payment ${payment.status.toLowerCase()}`,
        variant: payment.status === 'SUCCEEDED' ? 'success' : 'warning',
      });
    },
    onError: (err) => {
      toast({
        title: 'Payment simulation failed',
        description: extractErrorMessage(err),
        variant: 'error',
      });
    },
  });

  if (!orderId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <ErrorState
          title="Missing order reference"
          message="Please access payment from your checkout flow or order details."
        />
      </div>
    );
  }

  if (orderQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <ErrorState
          title="Order not found"
          onRetry={() => orderQuery.refetch()}
        />
      </div>
    );
  }

  const order = orderQuery.data;
  const latestPayment = paymentsQuery.data?.[0];
  const isRefunded = latestPayment?.status === 'REFUNDED' || order.status === 'REFUNDED';
  const isCancelled =
    !isRefunded && (order.status === 'CANCELLED' || latestPayment?.status === 'CANCELLED');
  const isSucceeded =
    !isRefunded &&
    !isCancelled &&
    (latestPayment?.status === 'SUCCEEDED' ||
      order.status === 'CONFIRMED' ||
      order.status === 'PROCESSING' ||
      order.status === 'SHIPPED' ||
      order.status === 'DELIVERED');
  const isFailed =
    !isSucceeded &&
    !isRefunded &&
    !isCancelled &&
    (latestPayment?.status === 'FAILED' || order.status === 'PAYMENT_FAILED');
  const isPending = !isSucceeded && !isRefunded && !isCancelled;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            {isSucceeded ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            ) : isFailed || isCancelled ? (
              <XCircle className="h-8 w-8 text-red-600" />
            ) : (
              <CreditCard className="h-8 w-8 text-primary-600" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isSucceeded
              ? 'Payment Successful!'
              : isRefunded
                ? 'Payment Auto-Refunded'
                : isCancelled
                  ? 'Order Cancelled'
                  : isFailed
                    ? 'Payment Failed'
                    : 'Complete Payment'}
          </CardTitle>
          <p className="mt-1 text-sm text-gray-500">
            Order <strong>{order.orderNumber}</strong> • Amount:{' '}
            <strong>{formatCurrency(order.totalAmount)}</strong>
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4 text-sm">
            <span className="text-gray-600">Order Status</span>
            <OrderStatusBadge status={order.status} />
          </div>

          {isSucceeded && (
            <div
              data-testid="payment-success"
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
            >
              <p className="font-semibold">Payment confirmed and inventory locked!</p>
              <p className="mt-1">
                Transaction ID:{' '}
                <span className="font-mono">{latestPayment?.transactionId || 'CONFIRMED'}</span>
              </p>
            </div>
          )}

          {isRefunded && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold">Reservation expired before payment settled</p>
              <p className="mt-1">
                FlashCart automatically refunded the late payment and released any stale state.
              </p>
            </div>
          )}

          {isCancelled && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">This order has been cancelled</p>
              <p className="mt-1">
                Reserved inventory has been released and payment is no longer accepted for this order.
              </p>
            </div>
          )}

          {isFailed && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-semibold">Payment attempt did not succeed</p>
              <p className="mt-1">
                {latestPayment?.failureReason || 'You can retry payment below.'}
              </p>
            </div>
          )}

          {isPending && (
            <div className="space-y-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Payment Simulator Controls
              </p>
              <p className="text-sm text-gray-600">
                Simulate gateway webhook callbacks with idempotent handling:
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Button
                  data-testid="simulate-success-button"
                  isLoading={simulateMutation.isPending}
                  onClick={() => simulateMutation.mutate('SUCCEEDED')}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Simulate Success
                </Button>
                <Button
                  variant="danger"
                  isLoading={simulateMutation.isPending}
                  onClick={() => simulateMutation.mutate('FAILED')}
                >
                  <XCircle className="h-4 w-4" />
                  Simulate Failure
                </Button>
                <Button
                  variant="outline"
                  isLoading={simulateMutation.isPending}
                  onClick={() => simulateMutation.mutate('TIMEOUT')}
                >
                  <Clock className="h-4 w-4" />
                  Simulate Timeout
                </Button>
              </div>
              {isFailed && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full mt-2"
                  isLoading={initiateMutation.isPending}
                  onClick={() => initiateMutation.mutate()}
                >
                  <RefreshCw className="h-4 w-4" />
                  Start New Payment Attempt
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Link to={`/orders/${order.id}`}>
              <Button variant="outline">View Order Details</Button>
            </Link>
            <Link to="/orders">
              <Button variant="ghost">All Orders</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
