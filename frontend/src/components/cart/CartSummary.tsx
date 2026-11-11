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
    <Card>
      <CardHeader>
        <CardTitle>Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Items ({cart.totalItems})</span>
          <span>{formatCurrency(cart.subtotal)}</span>
        </div>
        {cart.discountAmount > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>Flash Sale Savings</span>
            <span>-{formatCurrency(cart.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-gray-600">
          <span>Shipping</span>
          <span className="text-emerald-600 font-medium">Free</span>
        </div>
        <div className="border-t border-gray-200 pt-3 flex justify-between text-base font-bold text-gray-900">
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
