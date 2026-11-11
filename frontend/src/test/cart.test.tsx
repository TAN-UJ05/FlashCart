import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CartItem } from '../components/cart/CartItem';
import { CartSummary } from '../components/cart/CartSummary';
import type { Cart, CartItem as CartItemType } from '../types';

const sampleCartItem: CartItemType = {
  id: 'ci-1',
  productId: 'prod-1',
  productName: 'Mechanical Keyboard',
  productSku: 'SKU-KB-01',
  regularPrice: 4500,
  effectivePrice: 3500,
  onFlashSale: true,
  quantity: 2,
  lineTotal: 7000,
  availableStock: 10,
};

const sampleCart: Cart = {
  id: 'cart-1',
  items: [sampleCartItem],
  totalItems: 2,
  subtotal: 9000,
  discountAmount: 2000,
  totalAmount: 7000,
};

describe('Cart Components', () => {
  it('calls update quantity and remove using productId', async () => {
    const user = userEvent.setup();
    const onUpdateQuantity = vi.fn();
    const onRemove = vi.fn();

    render(
      <MemoryRouter>
        <CartItem
          item={sampleCartItem}
          onUpdateQuantity={onUpdateQuantity}
          onRemove={onRemove}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Mechanical Keyboard')).toBeInTheDocument();
    expect(screen.getByText('Flash Sale Price')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Increase quantity'));
    expect(onUpdateQuantity).toHaveBeenCalledWith('prod-1', 3);

    await user.click(screen.getByLabelText('Decrease quantity'));
    expect(onUpdateQuantity).toHaveBeenCalledWith('prod-1', 1);

    await user.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalledWith('prod-1');
  });

  it('renders cart summary totals and triggers checkout', async () => {
    const user = userEvent.setup();
    const onCheckout = vi.fn();

    render(<CartSummary cart={sampleCart} onCheckout={onCheckout} />);

    expect(screen.getByText(/Items \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Flash Sale Savings/i)).toBeInTheDocument();

    await user.click(screen.getByTestId('checkout-button'));
    expect(onCheckout).toHaveBeenCalledTimes(1);
  });
});
