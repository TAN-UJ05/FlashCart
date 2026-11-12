import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Clock,
  CreditCard,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Landmark,
  FlaskConical,
} from 'lucide-react';
import * as orderService from '../../services/order.service';
import * as paymentService from '../../services/payment.service';
import { useAuth } from '../../stores/auth.store';
import { useToast } from '../../stores/toast.store';
import { extractErrorMessage, formatCurrency, generateIdempotencyKey } from '../../utils/format';
import { OrderStatusBadge } from '../../components/order/OrderStatusBadge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';

type SandboxMethod = 'UPI' | 'CARD' | 'NETBANKING';

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') ?? '';
  const paymentIdParam = searchParams.get('paymentId') ?? '';
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<SandboxMethod>('UPI');
  const [paymentOverride, setPaymentOverride] = useState<{
    orderId: string;
    paymentId: string;
  } | null>(null);

  const orderQuery = useQuery({
    queryKey: ['order', user?.id ?? 'anon', orderId],
    queryFn: async () => {
      const res = await orderService.getOrder(orderId);
      return res.data;
    },
    enabled: !!orderId && !!user?.id,
  });

  const paymentsQuery = useQuery({
    queryKey: ['payments', 'order', user?.id ?? 'anon', orderId],
    queryFn: async () => {
      const res = await paymentService.getPaymentsForOrder(orderId);
      return res.data;
    },
    enabled: !!orderId && !!user?.id,
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
      setPaymentOverride({ orderId, paymentId: payment.id });
      queryClient.invalidateQueries({ queryKey: ['payments', 'order', user?.id ?? 'anon', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order', user?.id ?? 'anon', orderId] });
    },
    onError: (err) => {
      toast({
        title: 'Could not initiate payment',
        description: extractErrorMessage(err),
        variant: 'error',
      });
    },
  });

  const activePaymentId = paymentOverride?.orderId === orderId ? paymentOverride.paymentId : '';
  const resolvedPaymentId = activePaymentId || paymentIdParam || paymentsQuery.data?.[0]?.id || '';
  const waitingForPaymentsLookup = !resolvedPaymentId && paymentsQuery.isLoading;

  const simulateMutation = useMutation({
    mutationFn: async (outcome: 'SUCCEEDED' | 'FAILED' | 'TIMEOUT') => {
      let pid = resolvedPaymentId;
      if (!pid) {
        const initRes = await paymentService.initiatePayment(orderId, orderId);
        pid = initRes.data.id;
        setPaymentOverride({ orderId, paymentId: pid });
      }
      const res = await paymentService.simulatePayment({
        paymentId: pid,
        transactionId: `SIM-${Date.now()}`,
        outcome,
        failureReason:
          outcome === 'FAILED'
            ? 'Payment declined by issuing bank (sandbox test)'
            : outcome === 'TIMEOUT'
              ? 'Payment gateway timed out (sandbox test)'
              : undefined,
      });
      return res.data;
    },
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: ['order', user?.id ?? 'anon', orderId] });
      queryClient.invalidateQueries({ queryKey: ['payments', 'order', user?.id ?? 'anon', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      queryClient.invalidateQueries({ queryKey: ['flash-sales'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] });
      toast({
        title: `Payment ${payment.status.toLowerCase()}`,
        variant: payment.status === 'SUCCEEDED' ? 'success' : 'warning',
      });
    },
    onError: (err) => {
      toast({
        title: 'Payment processing error',
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
        <Skeleton className="h-96 w-full rounded-2xl" />
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
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 animate-fade-in-up">
      <Card className="overflow-hidden">
        <CardHeader className="bg-slate-950 text-white border-slate-800 text-center py-8">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            {isSucceeded ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            ) : isFailed || isCancelled ? (
              <XCircle className="h-8 w-8 text-rose-400" />
            ) : (
              <CreditCard className="h-8 w-8 text-primary-300" />
            )}
          </div>
          <CardTitle className="font-display text-2xl text-white">
            {isSucceeded
              ? 'Payment Confirmed'
              : isRefunded
                ? 'Payment Auto-Refunded'
                : isCancelled
                  ? 'Order Cancelled'
                  : isFailed
                    ? 'Payment Declined'
                    : 'Secure Sandbox Checkout'}
          </CardTitle>
          <p className="mt-1.5 text-sm text-slate-300 tabular-nums">
            Order <span className="font-mono font-semibold text-white">{order.orderNumber}</span>
            {' · '}
            <strong className="text-white">{formatCurrency(order.totalAmount)}</strong>
          </p>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-sm">
            <span className="font-medium text-slate-600">Order Status</span>
            <OrderStatusBadge status={order.status} />
          </div>

          {isSucceeded && (
            <div
              data-testid="payment-success"
              className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-sm text-emerald-900"
            >
              <p className="font-bold">Payment verified and your order is confirmed!</p>
              <p className="mt-1 text-emerald-800">
                Transaction Reference:{' '}
                <span className="font-mono font-semibold">{latestPayment?.transactionId || 'CONFIRMED'}</span>
              </p>
            </div>
          )}

          {isRefunded && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-sm text-amber-900">
              <p className="font-bold">Reservation window elapsed before settlement</p>
              <p className="mt-1">
                Your payment was automatically refunded because the 15-minute stock hold expired prior to confirmation.
              </p>
            </div>
          )}

          {isCancelled && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
              <p className="font-bold text-slate-900">This order has been cancelled</p>
              <p className="mt-1">
                Held items have been returned to inventory and payment is no longer open for this order.
              </p>
            </div>
          )}

          {isFailed && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-5 text-sm text-rose-900">
              <p className="font-bold">Payment attempt did not go through</p>
              <p className="mt-1 text-rose-800">
                {latestPayment?.failureReason || 'You can start a fresh attempt or complete payment below.'}
              </p>
            </div>
          )}

          {isPending && (
            <div className="space-y-5">
              {/* Payment Method Tabs */}
              <div>
                <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Select Payment Method
                </p>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'UPI' as const, label: 'UPI / QR', icon: Smartphone },
                    { id: 'CARD' as const, label: 'Card', icon: CreditCard },
                    { id: 'NETBANKING' as const, label: 'NetBanking', icon: Landmark },
                  ].map((method) => {
                    const Icon = method.icon;
                    const active = selectedMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setSelectedMethod(method.id)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition-all ${
                          active
                            ? 'border-primary-600 bg-primary-50/70 text-primary-700 shadow-xs ring-2 ring-primary-500/15'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <Icon className="h-4.5 w-4.5" />
                        {method.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-600">
                {selectedMethod === 'UPI' && (
                  <p>Sandbox UPI ID: <span className="font-mono font-semibold text-slate-800">success@razorpay</span> · Instant settlement in test mode.</p>
                )}
                {selectedMethod === 'CARD' && (
                  <p>Sandbox Card: <span className="font-mono font-semibold text-slate-800">4242 •••• •••• 4242</span> · Test authorization without real charges.</p>
                )}
                {selectedMethod === 'NETBANKING' && (
                  <p>Sandbox Bank: <span className="font-mono font-semibold text-slate-800">HDFC / ICICI Test NetBanking</span> · Redirect-free sandbox callback.</p>
                )}
              </div>

              <Button
                size="lg"
                className="w-full"
                data-testid="simulate-success-button"
                disabled={waitingForPaymentsLookup || initiateMutation.isPending}
                isLoading={simulateMutation.isPending}
                onClick={() => simulateMutation.mutate('SUCCEEDED')}
              >
                <ShieldCheck className="h-5 w-5" />
                Pay {formatCurrency(order.totalAmount)} Now
              </Button>

              {isFailed && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  isLoading={initiateMutation.isPending}
                  onClick={() => initiateMutation.mutate()}
                >
                  <RefreshCw className="h-4 w-4" />
                  Create New Payment Attempt
                </Button>
              )}

              {/* Subtle Sandbox Diagnostics */}
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <FlaskConical className="h-3.5 w-3.5" />
                  Sandbox Gateway Test Outcomes
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Because live merchant keys are disabled locally, use these triggers to test declined or timed-out payment webhooks:
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-rose-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                    disabled={waitingForPaymentsLookup || initiateMutation.isPending}
                    isLoading={simulateMutation.isPending}
                    onClick={() => simulateMutation.mutate('FAILED')}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Test Declined Card
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={waitingForPaymentsLookup || initiateMutation.isPending}
                    isLoading={simulateMutation.isPending}
                    onClick={() => simulateMutation.mutate('TIMEOUT')}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Test Gateway Timeout
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-4">
            <Link to={`/orders/${order.id}`}>
              <Button variant="outline">View Order Details</Button>
            </Link>
            <Link to={isAdmin && order.userId && user?.id !== order.userId ? '/admin/orders' : '/orders'}>
              <Button variant="ghost">All Orders</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
