import type { MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, SlidersHorizontal, Zap } from 'lucide-react';
import type { Product } from '../../types';
import { formatCurrency, getPrimaryImageUrl } from '../../utils/format';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useAuth } from '../../stores/auth.store';
import { useCart } from '../../hooks/useCart';

export interface ProductCardProps {
  product: Product;
  index?: number;
}

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuth();
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

  const handleManageProduct = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/admin/products/${product.id}/edit`);
  };

  return (
    <Link
      to={`/products/${product.id}`}
      data-testid="product-card"
      style={{ animationDelay: `${Math.min(index, 7) * 45}ms` }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/85 bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-elevated animate-fade-in-up"
    >
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        <img
          src={imageUrl}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
        />
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {product.activeFlashSalePrice != null && (
            <Badge className="gap-1 border-0 bg-amber-500 text-slate-950 shadow-sm">
              <Zap className="h-3 w-3 fill-current" />
              Flash Drop
            </Badge>
          )}
          {discountPct > 0 && (
            <Badge className="border-0 bg-rose-600 text-white shadow-sm tabular-nums">
              -{discountPct}%
            </Badge>
          )}
        </div>
        {!inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45 backdrop-blur-[2px]">
            <span className="rounded-full bg-white/95 px-3.5 py-1 text-xs font-bold text-slate-900 shadow-sm">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4.5">
        {product.categoryName && (
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary-600">
            {product.categoryName}
          </span>
        )}
        <h3 className="mt-1.5 line-clamp-2 text-sm font-bold leading-snug text-slate-900 transition-colors group-hover:text-primary-600">
          {product.name}
        </h3>
        <p className="mt-1 font-mono text-[11px] text-slate-400">SKU: {product.sku}</p>

        <div className="mt-auto pt-4 flex items-center justify-between gap-2 border-t border-slate-100">
          <div>
            <div className="text-base font-extrabold tabular-nums text-slate-900">
              {formatCurrency(effectivePrice)}
            </div>
            {originalPrice && originalPrice > effectivePrice && (
              <div className="text-xs tabular-nums text-slate-400 line-through">
                {formatCurrency(originalPrice)}
              </div>
            )}
          </div>

          {isAdmin ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleManageProduct}
              data-testid="admin-manage-product"
              aria-label={`Manage ${product.name}`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Manage
            </Button>
          ) : (
            <Button
              size="sm"
              variant={inStock ? 'primary' : 'outline'}
              disabled={!inStock || isAdding}
              onClick={handleQuickAdd}
              data-testid="quick-add-to-cart"
              aria-label={`Add ${product.name} to cart`}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Add
            </Button>
          )}
        </div>
      </div>
    </Link>
  );
}
