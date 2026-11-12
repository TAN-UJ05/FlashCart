import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Minus,
  Plus,
  ShoppingCart,
  Zap,
  CheckCircle2,
  AlertCircle,
  Shield,
  SlidersHorizontal,
} from 'lucide-react';
import * as productService from '../../services/product.service';
import { useAuth } from '../../stores/auth.store';
import { useCart } from '../../hooks/useCart';
import { formatCurrency, getPrimaryImageUrl } from '../../utils/format';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ProductGrid } from '../../components/product/ProductGrid';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuth();
  const { addItem, isAdding } = useCart();

  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const productQuery = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const res = await productService.getProduct(id!);
      return res.data;
    },
    enabled: !!id,
  });

  const product = productQuery.data;

  const relatedQuery = useQuery({
    queryKey: ['products', 'related', product?.categoryId],
    queryFn: async () => {
      const res = await productService.getProducts({
        categoryId: product?.categoryId,
        size: 4,
      });
      return res.data.content.filter((p) => p.id !== product?.id).slice(0, 4);
    },
    enabled: !!product?.categoryId,
  });

  if (productQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-48" />
          </div>
        </div>
      </div>
    );
  }

  if (productQuery.isError || !product) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorState
          title="Product not found"
          message="We couldn't load this product. It may have been removed or is temporarily unavailable."
          onRetry={() => productQuery.refetch()}
        />
      </div>
    );
  }

  const images =
    product.images && product.images.length > 0
      ? [...product.images].sort((a, b) => a.sortOrder - b.sortOrder)
      : [{ id: 'placeholder', imageUrl: getPrimaryImageUrl(product.images), sortOrder: 0, isPrimary: true }];

  const currentImage = images[selectedImageIdx] ?? images[0];
  const effectivePrice = product.activeFlashSalePrice ?? product.price;
  const originalPrice = product.activeFlashSalePrice ? product.price : product.compareAtPrice;
  const inStock = product.availableStock > 0;

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    await addItem({ productId: product.id, quantity });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-16">
      <div>
        <Link
          to="/products"
          className="mb-6 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Catalog
        </Link>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* Images */}
          <div className="space-y-4 animate-fade-in">
            <div className="aspect-square overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-soft">
              <img
                src={currentImage.imageUrl}
                alt={currentImage.altText ?? product.name}
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
              />
            </div>
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setSelectedImageIdx(idx)}
                    className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                      idx === selectedImageIdx
                        ? 'border-primary-600 ring-2 ring-primary-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <img
                      src={img.imageUrl}
                      alt={img.altText ?? product.name}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col animate-fade-in-up">
            {product.categoryName && (
              <Link
                to={product.categorySlug ? `/categories/${product.categorySlug}` : '/products'}
                className="text-xs font-bold uppercase tracking-wider text-primary-600 hover:text-primary-700"
              >
                {product.categoryName}
              </Link>
            )}
            <h1 className="mt-2 font-display text-3xl font-bold text-slate-900 sm:text-4xl">
              {product.name}
            </h1>
            <p className="mt-1.5 font-mono text-xs text-slate-400">SKU: {product.sku}</p>

            <div className="mt-6 flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-extrabold tabular-nums text-slate-900">
                {formatCurrency(effectivePrice)}
              </span>
              {originalPrice && originalPrice > effectivePrice && (
                <span className="text-lg tabular-nums text-slate-400 line-through">
                  {formatCurrency(originalPrice)}
                </span>
              )}
              {product.activeFlashSalePrice != null && (
                <Badge className="gap-1 border-0 bg-amber-400 text-slate-950">
                  <Zap className="h-3 w-3 fill-current" />
                  Flash Drop Active
                </Badge>
              )}
            </div>

            <div className="mt-4">
              {inStock ? (
                <Badge variant="success" className="gap-1.5 px-3 py-1 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  In Stock ({product.availableStock} available)
                </Badge>
              ) : (
                <Badge variant="danger" className="gap-1.5 px-3 py-1 text-xs">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Out of Stock
                </Badge>
              )}
            </div>

            <div className="mt-6 border-t border-slate-200/80 pt-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Product Details
              </h2>
              <p className="mt-2.5 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {product.description || 'No description available for this product.'}
              </p>
            </div>

            {isAdmin ? (
              <div className="mt-8 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Shield className="h-4 w-4 text-primary-600" />
                  Administrator Preview Mode
                </div>
                <p className="text-xs leading-relaxed text-slate-600">
                  Administrator accounts manage catalog items and stock levels rather than placing customer orders.
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Link to={`/admin/products/${product.id}/edit`}>
                    <Button size="md">
                      <SlidersHorizontal className="h-4 w-4" />
                      Edit Product
                    </Button>
                  </Link>
                  <Link to="/admin/inventory">
                    <Button size="md" variant="outline">
                      Adjust Inventory
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white shadow-xs">
                  <button
                    type="button"
                    disabled={!inStock || quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="rounded-l-xl p-3.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center text-sm font-bold tabular-nums text-slate-900">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    disabled={!inStock || quantity >= product.availableStock}
                    onClick={() => setQuantity((q) => Math.min(product.availableStock, q + 1))}
                    className="rounded-r-xl p-3.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <Button
                  size="lg"
                  className="flex-1 min-w-[200px]"
                  disabled={!inStock}
                  isLoading={isAdding}
                  onClick={handleAddToCart}
                  data-testid="add-to-cart-button"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {inStock ? 'Add to Cart' : 'Out of Stock'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Related Products */}
      {relatedQuery.data && relatedQuery.data.length > 0 && (
        <section>
          <h2 className="mb-6 font-display text-2xl font-bold text-slate-900">You Might Also Like</h2>
          <ProductGrid products={relatedQuery.data} />
        </section>
      )}
    </div>
  );
}
