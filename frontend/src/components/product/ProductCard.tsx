import type { MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Zap } from 'lucide-react';
import type { Product } from '../../types';
import { formatCurrency, getPrimaryImageUrl } from '../../utils/format';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useAuth } from '../../stores/auth.store';
import { useCart } from '../../hooks/useCart';

export interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { addItem, isAdding } = useCart();

  const imageUrl = getPrimaryImageUrl(product.images);
  const effectivePrice = product.activeFlashSalePrice ?? product.price;
  const originalPrice = product.activeFlashSalePrice
    ? product.price
    : product.compareAtPrice;
  const inStock = product.availableStock > 0;
  const discountPct =
    originalPrice && originalPrice > effectivePrice
      ? Math.round(((originalPrice - effectivePrice) / originalPrice) * 100)
      : 0;

  const handleQuickAdd = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    await addItem({ productId: product.id, quantity: 1 });
  };

  return (
    <Link
      to={`/products/${product.id}`}
      data-testid="product-card"
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        <img
          src={imageUrl}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {product.activeFlashSalePrice != null && (
            <Badge variant="primary" className="gap-1 bg-primary-600 text-white border-0 shadow-sm">
              <Zap className="h-3 w-3" />
              Flash Sale
            </Badge>
          )}
          {discountPct > 0 && (
            <Badge variant="danger" className="bg-red-600 text-white border-0 shadow-sm">
              -{discountPct}%
            </Badge>
          )}
        </div>
        {!inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-900">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {product.categoryName && (
          <span className="text-xs font-medium uppercase tracking-wider text-primary-600">
            {product.categoryName}
          </span>
        )}
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-primary-600">
          {product.name}
        </h3>
        <p className="mt-0.5 text-xs text-gray-400">SKU: {product.sku}</p>

        <div className="mt-auto pt-4 flex items-center justify-between gap-2">
          <div>
            <div className="text-base font-bold text-gray-900">
              {formatCurrency(effectivePrice)}
            </div>
            {originalPrice && originalPrice > effectivePrice && (
              <div className="text-xs text-gray-400 line-through">
                {formatCurrency(originalPrice)}
              </div>
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            disabled={!inStock || isAdding}
            onClick={handleQuickAdd}
            data-testid="quick-add-to-cart"
            aria-label={`Add ${product.name} to cart`}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </div>
    </Link>
  );
}
