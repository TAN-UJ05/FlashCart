import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Minus, Plus, ShoppingCart, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
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
  const { isAuthenticated } = useAuth();
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
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Products
        </Link>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* Images */}
          <div className="space-y-4">
            <div className="aspect-square overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <img
                src={currentImage.imageUrl}
                alt={currentImage.altText ?? product.name}
                className="h-full w-full object-cover"
              />
            </div>
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setSelectedImageIdx(idx)}
                    className={`h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${
                      idx === selectedImageIdx ? 'border-primary-600' : 'border-gray-200'
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
          <div className="flex flex-col">
            {product.categoryName && (
              <Link
                to={product.categorySlug ? `/categories/${product.categorySlug}` : '/products'}
                className="text-sm font-semibold uppercase tracking-wider text-primary-600 hover:text-primary-700"
              >
                {product.categoryName}
              </Link>
            )}
            <h1 className="mt-2 text-3xl font-bold text-gray-900">{product.name}</h1>
            <p className="mt-1 text-sm text-gray-500">SKU: {product.sku}</p>

            <div className="mt-6 flex items-baseline gap-3">
              <span className="text-3xl font-extrabold text-gray-900">
                {formatCurrency(effectivePrice)}
              </span>
              {originalPrice && originalPrice > effectivePrice && (
                <span className="text-lg text-gray-400 line-through">
                  {formatCurrency(originalPrice)}
                </span>
              )}
              {product.activeFlashSalePrice != null && (
                <Badge variant="primary" className="gap-1">
                  <Zap className="h-3 w-3" />
                  Flash Sale Active
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

            <div className="mt-6 border-t border-gray-200 pt-6">
              <h2 className="text-sm font-semibold text-gray-900">Description</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">
                {product.description || 'No description available for this product.'}
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <div className="inline-flex items-center rounded-lg border border-gray-300 bg-white">
                <button
                  type="button"
                  disabled={!inStock || quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-3 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-12 text-center text-sm font-semibold text-gray-900">
                  {quantity}
                </span>
                <button
                  type="button"
                  disabled={!inStock || quantity >= product.availableStock}
                  onClick={() => setQuantity((q) => Math.min(product.availableStock, q + 1))}
                  className="p-3 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
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
          </div>
        </div>
      </div>

      {/* Related Products */}
      {relatedQuery.data && relatedQuery.data.length > 0 && (
        <section>
          <h2 className="mb-6 text-2xl font-bold text-gray-900">Related Products</h2>
          <ProductGrid products={relatedQuery.data} />
        </section>
      )}
    </div>
  );
}
