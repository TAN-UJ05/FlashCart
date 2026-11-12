import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Zap } from 'lucide-react';
import * as flashSaleService from '../../services/flashsale.service';
import * as userService from '../../services/user.service';
import * as paymentService from '../../services/payment.service';
import type { FlashSaleItem } from '../../types';
import { useAuth } from '../../stores/auth.store';
import { useToast } from '../../stores/toast.store';
import { extractErrorMessage, generateIdempotencyKey } from '../../utils/format';
import { CountdownTimer } from '../../components/flash-sale/CountdownTimer';
import { FlashSaleCard } from '../../components/flash-sale/FlashSaleCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { ProductCardSkeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function FlashSalePage() {
  const { isAuthenticated, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedItem, setSelectedItem] = useState<FlashSaleItem | null>(null);
  const [shippingFullName, setShippingFullName] = useState('');
  const [shippingAddressLine1, setShippingAddressLine1] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingPostalCode, setShippingPostalCode] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');

  const salesQuery = useQuery({
    queryKey: ['flash-sales', 'active'],
    queryFn: async () => {
      const res = await flashSaleService.getActiveFlashSales();
      return res.data;
    },
    refetchInterval: 10000,
  });

  const addressesQuery = useQuery({
    queryKey: ['addresses', user?.id ?? 'anon'],
    queryFn: async () => {
      const res = await userService.getAddresses();
      return res.data;
    },
    enabled: isAuthenticated && !!user?.id && !isAdmin,
  });

  const savedAddresses = addressesQuery.data ?? [];
  const effectiveAddressId = savedAddresses.some((a) => a.id === selectedAddressId)
    ? selectedAddressId
    : '';

  const purchaseMutation = useMutation({
    mutationFn: async (item: FlashSaleItem) => {
      if (isAdmin) {
        throw new Error('Administrator accounts cannot place customer orders.');
      }
      if (
        !effectiveAddressId &&
        (!shippingFullName.trim() ||
          !shippingAddressLine1.trim() ||
          !shippingCity.trim() ||
          !shippingState.trim() ||
          !shippingPostalCode.trim())
      ) {
        throw new Error('Please fill in all required shipping address fields.');
      }
      const idempotencyKey = generateIdempotencyKey('fs');
      const res = await flashSaleService.purchaseFlashSaleItem(item.flashSaleId, {
        productId: item.productId,
        quantity: 1,
        idempotencyKey,
        addressId: effectiveAddressId || undefined,
        shippingFullName: effectiveAddressId ? undefined : shippingFullName.trim(),
        shippingAddressLine1: effectiveAddressId ? undefined : shippingAddressLine1.trim(),
        shippingCity: effectiveAddressId ? undefined : shippingCity.trim(),
        shippingState: effectiveAddressId ? undefined : shippingState.trim(),
        shippingPostalCode: effectiveAddressId ? undefined : shippingPostalCode.trim(),
      });
      const order = res.data;
      const payRes = await paymentService.initiatePayment(order.id, order.id);
      return { order, payment: payRes.data };
    },
    onSuccess: ({ order, payment }) => {
      setSelectedItem(null);
      queryClient.invalidateQueries({ queryKey: ['flash-sales', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      toast({
        title: 'Flash drop item reserved!',
        description: `Order ${order.orderNumber} created. Complete payment to confirm.`,
        variant: 'success',
      });
      navigate(`/payment-result?orderId=${order.id}&paymentId=${payment.id}`);
    },
    onError: (err) => {
      toast({
        title: 'Flash sale purchase failed',
        description: extractErrorMessage(err, 'Item may be sold out or unavailable.'),
        variant: 'error',
      });
    },
  });

  const handleBuyClick = (item: FlashSaleItem) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (isAdmin) {
      navigate('/admin/flash-sales');
      return;
    }
    const defaultAddr = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
    setSelectedAddressId(defaultAddr?.id ?? '');
    setShippingFullName('');
    setShippingAddressLine1('');
    setShippingCity('');
    setShippingState('');
    setShippingPostalCode('');
    setSelectedItem(item);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-10">
      <div className="relative overflow-hidden rounded-3xl bg-[#0B1120] p-8 text-white shadow-elevated">
        <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-35" />
        <div className="pointer-events-none absolute -top-20 right-10 h-64 w-64 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300">
              <Zap className="h-3.5 w-3.5 fill-current" />
              Limited Quantities
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Live Flash Drops</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              Exclusive markdowns on select hardware and essentials. Stock counts update live as claims come in.
            </p>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => navigate('/admin/flash-sales')}
              className="border-slate-700 bg-slate-900/80 text-white hover:bg-slate-800 hover:text-white"
            >
              <Shield className="h-4 w-4 text-primary-400" />
              Manage Campaigns
            </Button>
          )}
        </div>
      </div>

      {salesQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <ProductCardSkeleton key={idx} />
          ))}
        </div>
      ) : salesQuery.isError ? (
        <ErrorState
          title="Could not load flash drops"
          onRetry={() => salesQuery.refetch()}
        />
      ) : !salesQuery.data || salesQuery.data.length === 0 ? (
        <EmptyState
          icon={<Zap className="h-6 w-6 text-primary-600" />}
          title="No active flash drops right now"
          description="Check back soon for upcoming limited-time deals."
        />
      ) : (
        <div className="space-y-12">
          {salesQuery.data.map((sale) => (
            <section key={sale.id} className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-slate-900">{sale.name}</h2>
                  {sale.description && (
                    <p className="mt-1 text-sm text-slate-500">{sale.description}</p>
                  )}
                </div>
                <CountdownTimer endTime={sale.endTime} />
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {sale.items.map((item, idx) => (
                  <FlashSaleCard
                    key={item.id}
                    item={item}
                    index={idx}
                    onPurchase={handleBuyClick}
                    isPurchasing={
                      purchaseMutation.isPending && selectedItem?.id === item.id
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {!isAdmin && (
        <Modal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          title={`Confirm Flash Deal: ${selectedItem?.productName ?? ''}`}
          description="Reserve 1 unit immediately and proceed to checkout payment."
        >
          {selectedItem && (
            <div className="space-y-4">
              {savedAddresses.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Select Saved Address
                  </label>
                  <select
                    value={effectiveAddressId}
                    onChange={(e) => setSelectedAddressId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="">Enter a new shipping address</option>
                    {savedAddresses.map((addr) => (
                      <option key={addr.id} value={addr.id}>
                        {addr.fullName} — {addr.addressLine1}, {addr.city}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!effectiveAddressId && (
                <div className="space-y-3">
                  <Input
                    label="Full Name"
                    value={shippingFullName}
                    onChange={(e) => setShippingFullName(e.target.value)}
                    placeholder="Recipient name"
                  />
                  <Input
                    label="Address Line 1"
                    value={shippingAddressLine1}
                    onChange={(e) => setShippingAddressLine1(e.target.value)}
                    placeholder="Street address"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      label="City"
                      value={shippingCity}
                      onChange={(e) => setShippingCity(e.target.value)}
                      placeholder="City"
                    />
                    <Input
                      label="State"
                      value={shippingState}
                      onChange={(e) => setShippingState(e.target.value)}
                      placeholder="State"
                    />
                    <Input
                      label="Postal Code"
                      value={shippingPostalCode}
                      onChange={(e) => setShippingPostalCode(e.target.value)}
                      placeholder="400001"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setSelectedItem(null)}>
                  Cancel
                </Button>
                <Button
                  isLoading={purchaseMutation.isPending}
                  onClick={() => purchaseMutation.mutate(selectedItem)}
                >
                  <Zap className="h-4 w-4" />
                  Reserve &amp; Pay
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
