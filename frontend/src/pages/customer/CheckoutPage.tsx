import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MapPin, ShieldCheck } from 'lucide-react';
import * as userService from '../../services/user.service';
import * as orderService from '../../services/order.service';
import * as paymentService from '../../services/payment.service';
import { CART_QUERY_KEY, useCart } from '../../hooks/useCart';
import { useAuth } from '../../stores/auth.store';
import { useToast } from '../../stores/toast.store';
import { extractErrorMessage, generateIdempotencyKey } from '../../utils/format';
import { CartSummary } from '../../components/cart/CartSummary';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';

const shippingSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(200),
  phone: z.string().max(20).optional(),
  addressLine1: z.string().min(1, 'Address line 1 is required').max(255),
  addressLine2: z.string().max(255).optional(),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(1, 'State is required').max(100),
  postalCode: z.string().min(1, 'Postal code is required').max(20),
  country: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

type ShippingFormValues = z.infer<typeof shippingSchema>;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const { cart, isLoading: cartLoading } = useCart();

  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [addressMode, setAddressMode] = useState<'auto' | 'saved' | 'new'>('auto');
  const [idempotencyKey] = useState(() => generateIdempotencyKey('checkout'));

  const addressesQuery = useQuery({
    queryKey: ['addresses', user?.id ?? 'anon'],
    queryFn: async () => {
      const res = await userService.getAddresses();
      return res.data;
    },
    enabled: !!user?.id && !isAdmin,
  });

  const addresses = addressesQuery.data ?? [];
  const defaultAddrId = addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? '';
  const effectiveAddressId = addresses.some((a) => a.id === selectedAddressId)
    ? selectedAddressId
    : defaultAddrId;
  const useNewAddress =
    addressMode === 'new' || (addressMode === 'auto' && addresses.length === 0);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ShippingFormValues>({
    resolver: zodResolver(shippingSchema),
    defaultValues: {
      country: 'India',
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (values?: ShippingFormValues) => {
      const payload =
        !useNewAddress && effectiveAddressId
          ? { addressId: effectiveAddressId, notes: values?.notes, idempotencyKey }
          : {
              shippingFullName: values!.fullName,
              shippingPhone: values?.phone,
              shippingAddressLine1: values!.addressLine1,
              shippingAddressLine2: values?.addressLine2,
              shippingCity: values!.city,
              shippingState: values!.state,
              shippingPostalCode: values!.postalCode,
              shippingCountry: values?.country || 'India',
              notes: values?.notes,
              idempotencyKey,
            };

      const orderRes = await orderService.checkout(payload);
      const order = orderRes.data;
      const paymentRes = await paymentService.initiatePayment(order.id, order.id);
      return { order, payment: paymentRes.data };
    },
    onSuccess: ({ order, payment }) => {
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      queryClient.invalidateQueries({ queryKey: ['flash-sales'] });
      toast({
        title: 'Order created',
        description: `Order ${order.orderNumber} reserved inventory. Complete payment now.`,
        variant: 'success',
      });
      navigate(`/payment-result?orderId=${order.id}&paymentId=${payment.id}`);
    },
    onError: (err) => {
      toast({
        title: 'Checkout failed',
        description: extractErrorMessage(err, 'Could not place your order.'),
        variant: 'error',
      });
    },
  });

  if (cartLoading || addressesQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EmptyState
          title="Your shopping bag is empty"
          description="Add products to your bag before checking out."
          action={
            <Link to="/products">
              <Button>Browse Catalog</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-fade-in">
      <h1 className="mb-8 font-display text-3xl font-bold text-slate-900">Checkout</h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary-600" />
                Shipping Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {addresses.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {addresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => {
                          setSelectedAddressId(addr.id);
                          setAddressMode('saved');
                        }}
                        className={`rounded-2xl border p-4 text-left transition-all ${
                          !useNewAddress && effectiveAddressId === addr.id
                            ? 'border-primary-600 bg-primary-50/50 ring-2 ring-primary-500/20'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">{addr.fullName}</span>
                          {addr.isDefault && (
                            <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{addr.addressLine1}</p>
                        <p className="text-sm text-slate-600">
                          {addr.city}, {addr.state} {addr.postalCode}
                        </p>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setAddressMode(useNewAddress ? 'saved' : 'new')}
                    className="text-sm font-semibold text-primary-600 hover:text-primary-700"
                  >
                    {useNewAddress ? '← Use a saved address' : '+ Ship to a different address'}
                  </button>
                </div>
              )}

              {useNewAddress ? (
                <form
                  id="checkout-form"
                  onSubmit={handleSubmit((values) => checkoutMutation.mutate(values))}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      label="Full Name"
                      placeholder="Jane Doe"
                      error={errors.fullName?.message}
                      {...register('fullName')}
                    />
                    <Input
                      label="Phone (Optional)"
                      placeholder="+91 98765 43210"
                      error={errors.phone?.message}
                      {...register('phone')}
                    />
                  </div>
                  <Input
                    label="Address Line 1"
                    placeholder="123 Main Street"
                    error={errors.addressLine1?.message}
                    {...register('addressLine1')}
                  />
                  <Input
                    label="Address Line 2 (Optional)"
                    placeholder="Apartment, suite, landmark"
                    error={errors.addressLine2?.message}
                    {...register('addressLine2')}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Input
                      label="City"
                      placeholder="Mumbai"
                      error={errors.city?.message}
                      {...register('city')}
                    />
                    <Input
                      label="State"
                      placeholder="Maharashtra"
                      error={errors.state?.message}
                      {...register('state')}
                    />
                    <Input
                      label="Postal Code"
                      placeholder="400001"
                      error={errors.postalCode?.message}
                      {...register('postalCode')}
                    />
                  </div>
                  <Input
                    label="Country"
                    placeholder="India"
                    error={errors.country?.message}
                    {...register('country')}
                  />
                  <Input
                    label="Order Notes (Optional)"
                    placeholder="Delivery instructions"
                    error={errors.notes?.message}
                    {...register('notes')}
                  />
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    isLoading={checkoutMutation.isPending}
                    data-testid="place-order-button"
                  >
                    <ShieldCheck className="h-5 w-5" />
                    Place Order &amp; Continue to Payment
                  </Button>
                </form>
              ) : (
                <Button
                  size="lg"
                  className="w-full"
                  isLoading={checkoutMutation.isPending}
                  onClick={() => checkoutMutation.mutate(undefined)}
                  data-testid="place-order-button"
                >
                  <ShieldCheck className="h-5 w-5" />
                  Place Order with Selected Address
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <CartSummary cart={cart} showCheckoutButton={false} />
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Items in Order</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100">
              {cart.items.map((item) => (
                <div key={item.id} className="flex justify-between py-2.5 text-sm">
                  <span className="text-slate-700">
                    {item.productName} × {item.quantity}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    ₹{item.lineTotal.toFixed(2)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
