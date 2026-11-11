import type { ReactElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductCard } from '../components/product/ProductCard';
import { ProductGrid } from '../components/product/ProductGrid';
import { ToastProvider } from '../stores/toast.store';
import * as authStore from '../stores/auth.store';
import * as useCartHook from '../hooks/useCart';
import type { Product } from '../types';

const sampleProduct: Product = {
  id: 'p1',
  name: 'Pro Wireless Headphones',
  sku: 'SKU-HP-01',
  price: 2999,
  compareAtPrice: 3999,
  categoryName: 'Electronics',
  active: true,
  totalStock: 20,
  reservedStock: 2,
  availableStock: 18,
  images: [],
};

function renderWithRouter(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe('Product Components', () => {
  beforeEach(() => {
    vi.spyOn(authStore, 'useAuth').mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      isAdmin: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshAuth: vi.fn(),
      setUser: vi.fn(),
    });
    vi.spyOn(useCartHook, 'useCart').mockReturnValue({
      cart: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      totalItems: 0,
      addItem: vi.fn(),
      isAdding: false,
      updateItem: vi.fn(),
      isUpdating: false,
      removeItem: vi.fn(),
      isRemoving: false,
      clearCart: vi.fn(),
    });
  });

  it('renders product details and discount badge', () => {
    renderWithRouter(<ProductCard product={sampleProduct} />);
    expect(screen.getByText('Pro Wireless Headphones')).toBeInTheDocument();
    expect(screen.getByText('SKU: SKU-HP-01')).toBeInTheDocument();
    expect(screen.getByText('-25%')).toBeInTheDocument();
  });

  it('disables add button and shows Out of Stock badge when stock is 0', () => {
    renderWithRouter(<ProductCard product={{ ...sampleProduct, availableStock: 0 }} />);
    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
    expect(screen.getByTestId('quick-add-to-cart')).toBeDisabled();
  });

  it('renders empty state when ProductGrid has no products', () => {
    renderWithRouter(<ProductGrid products={[]} />);
    expect(screen.getByText('No products found')).toBeInTheDocument();
  });
});
