import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { CartItem } from '../../components/cart/CartItem';
import { CartSummary } from '../../components/cart/CartSummary';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';

export default function CartPage() {
  const navigate = useNavigate();
  const {
    cart,
    isLoading,
    isError,
    refetch,
    updateItem,
    removeItem,
    clearCart,
    isUpdating,
    isRemoving,
  } = useCart();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-4">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorState title="Could not load your cart" onRetry={() => refetch()} />
      </div>
    );
  }

  const items = cart?.items ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900">Shopping Bag</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review quantities and pricing before checkout
          </p>
        </div>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearCart()}
            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          >
            <Trash2 className="h-4 w-4" />
            Clear Bag
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6 text-slate-500" />}
          title="Your shopping bag is empty"
          description="Looks like you haven't added anything yet."
          action={
            <Link to="/products">
              <Button>Browse Catalog</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                disabled={isUpdating || isRemoving}
                onUpdateQuantity={(productId, quantity) =>
                  updateItem({ productId, quantity })
                }
                onRemove={(productId) => removeItem(productId)}
              />
            ))}
          </div>

          <div className="lg:col-span-1">
            {cart && (
              <CartSummary
                cart={cart}
                onCheckout={() => navigate('/checkout')}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
