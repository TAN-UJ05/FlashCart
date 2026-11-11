import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Zap } from 'lucide-react';
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
  const { isAuthenticated } = useAuth();
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
    queryKey: ['addresses'],
    queryFn: async () => {
      const res = await userService.getAddresses();
      return res.data;
    },
    enabled: isAuthenticated,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (item: FlashSaleItem) => {
      const idempotencyKey = generateIdempotencyKey('fs');
      const res = await flashSaleService.purchaseFlashSaleItem(item.flashSaleId, {
        productId: item.productId,
        quantity: 1,
        idempotencyKey,
        addressId: selectedAddressId || undefined,
        shippingFullName: selectedAddressId ? undefined : shippingFullName,
        shippingAddressLine1: selectedAddressId ? undefined : shippingAddressLine1,
        shippingCity: selectedAddressId ? undefined : shippingCity,
        shippingState: selectedAddressId ? undefined : shippingState,
        shippingPostalCode: selectedAddressId ? undefined : shippingPostalCode,
      });
      const order = res.data;
      const payRes = await paymentService.initiatePayment(order.id, order.id);
      return { order, payment: payRes.data };
    },
    onSuccess: ({ order, payment }) => {
      setSelectedItem(null);
      queryClient.invalidateQueries({ queryKey: ['flash-sales', 'active'] });
      toast({
        title: 'Flash sale item reserved!',
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
    const defaultAddr = addressesQuery.data?.find((a) => a.isDefault) ?? addressesQuery.data?.[0];
    if (defaultAddr) {
      setSelectedAddressId(defaultAddr.id);
    }
    setSelectedItem(item);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <div className="rounded-2xl bg-gradient-to-r from-gray-900 via-primary-900 to-gray-900 p-8 text-white">
        <div className="flex items-center gap-2 text-primary-300 text-sm font-semibold">
          <Zap className="h-4 w-4" />
          ATOMIC STOCK ENGINE
        </div>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Live Flash Sales</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-300">
          Limited-stock deals enforced by PostgreSQL atomic counters and idempotency keys. Grab yours before stock runs out!
        </p>
      </div>

      {salesQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <ProductCardSkeleton key={idx} />
          ))}
        </div>
      ) : salesQuery.isError ? (
        <ErrorState
          title="Could not load flash sales"
          onRetry={() => salesQuery.refetch()}
        />
      ) : !salesQuery.data || salesQuery.data.length === 0 ? (
        <EmptyState
          icon={<Zap className="h-6 w-6 text-primary-600" />}
          title="No active flash sales right now"
          description="Check back soon for upcoming limited-time lightning deals."
        />
      ) : (
        <div className="space-y-10">
          {salesQuery.data.map((sale) => (
            <section key={sale.id} className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{sale.name}</h2>
                  {sale.description && (
                    <p className="mt-1 text-sm text-gray-500">{sale.description}</p>
                  )}
                </div>
                <CountdownTimer endTime={sale.endTime} />
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {sale.items.map((item) => (
                  <FlashSaleCard
                    key={item.id}
                    item={item}
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

      <Modal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={`Confirm Flash Deal: ${selectedItem?.productName ?? ''}`}
        description="Reserve 1 unit immediately and proceed to payment."
      >
        {selectedItem && (
          <div className="space-y-4">
            {addressesQuery.data && addressesQuery.data.length > 0 && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Select Saved Address
                </label>
                <select
                  value={selectedAddressId}
                  onChange={(e) => setSelectedAddressId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Enter a new shipping address</option>
                  {addressesQuery.data.map((addr) => (
                    <option key={addr.id} value={addr.id}>
                      {addr.fullName} — {addr.addressLine1}, {addr.city}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!selectedAddressId && (
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
    </div>
  );
}
