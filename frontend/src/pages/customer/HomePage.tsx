import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ShieldCheck, Truck, Zap, Layers } from 'lucide-react';
import * as productService from '../../services/product.service';
import * as categoryService from '../../services/category.service';
import * as flashSaleService from '../../services/flashsale.service';
import { ProductGrid } from '../../components/product/ProductGrid';
import { CountdownTimer } from '../../components/flash-sale/CountdownTimer';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';

export default function HomePage() {
  const productsQuery = useQuery({
    queryKey: ['products', 'featured'],
    queryFn: async () => {
      const res = await productService.getProducts({ page: 0, size: 8, sortBy: 'createdAt', sortDir: 'desc' });
      return res.data;
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await categoryService.getCategories();
      return res.data;
    },
  });

  const flashSalesQuery = useQuery({
    queryKey: ['flash-sales', 'active'],
    queryFn: async () => {
      const res = await flashSaleService.getActiveFlashSales();
      return res.data;
    },
  });

  const activeFlashSale = flashSalesQuery.data?.[0];

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Banner */}
      <section className="bg-gradient-to-br from-gray-900 via-gray-900 to-primary-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-600/20 px-3 py-1 text-xs font-semibold text-primary-300 border border-primary-500/30">
              <Zap className="h-3.5 w-3.5" />
              Zero-Overselling High-Concurrency Commerce
            </span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Lightning Deals. <span className="text-primary-400">Guaranteed Stock.</span>
            </h1>
            <p className="mt-4 text-lg text-gray-300">
              Shop curated electronics, fashion, books, and limited-edition flash sales backed by atomic inventory reservations.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/products">
                <Button size="lg">
                  Browse Catalog
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/flash-sales">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-gray-600 bg-transparent text-white hover:bg-white/10"
                >
                  <Zap className="h-4 w-4 text-primary-400" />
                  Live Flash Sales
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-12 px-4 sm:px-6 lg:px-8">
        {/* Live Flash Sale Banner */}
        {activeFlashSale && (
          <section className="overflow-hidden rounded-2xl border border-primary-200 bg-gradient-to-r from-primary-600 to-orange-500 p-6 text-white shadow-md sm:p-8">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider">
                    Live Now
                  </span>
                  <CountdownTimer endTime={activeFlashSale.endTime} />
                </div>
                <h2 className="mt-3 text-2xl font-bold sm:text-3xl">{activeFlashSale.name}</h2>
                {activeFlashSale.description && (
                  <p className="mt-1 text-sm text-primary-100">{activeFlashSale.description}</p>
                )}
              </div>
              <Link to="/flash-sales" className="shrink-0">
                <Button size="lg" variant="secondary" className="bg-white text-primary-700 hover:bg-gray-100">
                  Shop Flash Deals
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </section>
        )}

        {/* Featured Categories */}
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Shop by Category</h2>
            <Link to="/products" className="text-sm font-medium text-primary-600 hover:text-primary-700">
              View all products →
            </Link>
          </div>
          {categoriesQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : categoriesQuery.isError ? (
            <ErrorState
              title="Could not load categories"
              onRetry={() => categoriesQuery.refetch()}
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {(categoriesQuery.data ?? []).map((cat) => (
                <Link
                  key={cat.id}
                  to={`/categories/${cat.slug}`}
                  className="group flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-5 text-center transition-all hover:border-primary-300 hover:shadow-sm"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 group-hover:bg-primary-100">
                    <Layers className="h-5 w-5" />
                  </div>
                  <span className="mt-3 text-sm font-semibold text-gray-900 group-hover:text-primary-600">
                    {cat.name}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Featured Products */}
        <section>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Featured Products</h2>
              <p className="mt-1 text-sm text-gray-500">Latest arrivals across all categories</p>
            </div>
            <Link to="/products">
              <Button variant="outline" size="sm">
                See All
              </Button>
            </Link>
          </div>

          {productsQuery.isError ? (
            <ErrorState
              title="Could not load products"
              onRetry={() => productsQuery.refetch()}
            />
          ) : (
            <ProductGrid
              products={productsQuery.data?.content ?? []}
              isLoading={productsQuery.isLoading}
            />
          )}
        </section>

        {/* Value Props */}
        <section className="grid grid-cols-1 gap-6 rounded-2xl border border-gray-200 bg-white p-8 md:grid-cols-3">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Atomic Reservations</h3>
              <p className="mt-1 text-sm text-gray-500">
                Pessimistic PostgreSQL locking ensures zero overselling even at 10,000+ concurrent requests.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Idempotent Checkout</h3>
              <p className="mt-1 text-sm text-gray-500">
                Safe retry semantics prevent duplicate orders and double charges on unstable networks.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Fast Fulfillment</h3>
              <p className="mt-1 text-sm text-gray-500">
                Real-time order tracking from reservation through dispatch and doorstep delivery.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
