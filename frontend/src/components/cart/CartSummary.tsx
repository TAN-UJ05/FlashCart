import type { Cart } from '../../types';
import { formatCurrency } from '../../utils/format';
import { Button } from '../ui/Button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/Card';

export interface CartSummaryProps {
  cart: Cart;
  onCheckout?: () => void;
  showCheckoutButton?: boolean;
}

export function CartSummary({
  cart,
  onCheckout,
  showCheckoutButton = true,
}: CartSummaryProps) {
  return (
    <Card className="lg:sticky lg:top-24">
      <CardHeader>
        <CardTitle>Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm tabular-nums">
        <div className="flex justify-between text-slate-600">
          <span>Items ({cart.totalItems})</span>
          <span className="font-medium text-slate-900">{formatCurrency(cart.subtotal)}</span>
        </div>
        {cart.discountAmount > 0 && (
          <div className="flex justify-between text-emerald-600 font-medium">
            <span>Flash Sale Savings</span>
            <span>-{formatCurrency(cart.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-slate-600">
          <span>Shipping</span>
          <span className="font-semibold text-emerald-600">Free</span>
        </div>
        <div className="border-t border-slate-100 pt-3 flex justify-between text-base font-extrabold text-slate-900">
          <span>Total</span>
          <span>{formatCurrency(cart.totalAmount)}</span>
        </div>
      </CardContent>
      {showCheckoutButton && onCheckout && (
        <CardFooter>
          <Button
            className="w-full"
            size="lg"
            onClick={onCheckout}
            data-testid="checkout-button"
          >
            Proceed to Checkout
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
