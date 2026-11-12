import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, RotateCcw, Sparkles, Truck, Zap, Layers } from 'lucide-react';
import * as productService from '../../services/product.service';
import * as categoryService from '../../services/category.service';
import * as flashSaleService from '../../services/flashsale.service';
import { ProductGrid } from '../../components/product/ProductGrid';
import { CountdownTimer } from '../../components/flash-sale/CountdownTimer';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatCurrency } from '../../utils/format';

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
  const spotlightItem = activeFlashSale?.items?.[0];

  return (
    <div className="space-y-14 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#0B1120] text-white">
        <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-40" />
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary-600/25 blur-3xl animate-float-slow" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-amber-500/15 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-22">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7 animate-fade-in-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary-400/30 bg-primary-500/15 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-primary-200 backdrop-blur-xs">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                {activeFlashSale ? 'Limited Drops Live Now' : 'New Season Arrivals'}
              </span>
              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.08]">
                Curated tech &amp; everyday gear,{' '}
                <span className="bg-gradient-to-r from-primary-300 via-indigo-200 to-amber-300 bg-clip-text text-transparent">
                  priced for right now.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                Explore flagship electronics, precision workspace tools, and time-limited flash drops backed by live warehouse inventory.
              </p>
              <div className="mt-8 flex flex-wrap gap-3.5">
                <Link to="/products">
                  <Button size="lg" className="shadow-lg shadow-primary-600/25">
                    Browse Catalog
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/flash-sales">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-slate-700 bg-slate-900/60 text-white hover:border-slate-500 hover:bg-slate-800 hover:text-white"
                  >
                    <Zap className="h-4 w-4 text-amber-400 fill-current" />
                    Explore Flash Drops
                  </Button>
                </Link>
              </div>
            </div>

            {spotlightItem && activeFlashSale && (
              <div className="lg:col-span-5 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
                <Link
                  to={`/products/${spotlightItem.productId}`}
                  className="group block overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-primary-500/50 hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between gap-2 pb-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300">
                      <Zap className="h-3.5 w-3.5 fill-current" />
                      Featured Drop
                    </span>
                    <CountdownTimer endTime={activeFlashSale.endTime} />
                  </div>
                  <div className="overflow-hidden rounded-2xl bg-slate-800/70 aspect-[16/10]">
                    <img
                      src={spotlightItem.imageUrl || 'https://placehold.co/600x400/1e293b/818cf8?text=Flash+Drop'}
                      alt={spotlightItem.productName}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-400">{activeFlashSale.name}</p>
                      <h3 className="mt-0.5 truncate text-lg font-bold text-white group-hover:text-primary-300">
                        {spotlightItem.productName}
                      </h3>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <div className="text-xl font-extrabold text-amber-300">
                        {formatCurrency(spotlightItem.salePrice)}
                      </div>
                      {spotlightItem.regularPrice > spotlightItem.salePrice && (
                        <div className="text-xs text-slate-500 line-through">
                          {formatCurrency(spotlightItem.regularPrice)}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-14 px-4 sm:px-6 lg:px-8">
        {/* Live Flash Drop Banner */}
        {activeFlashSale && (
          <section className="relative overflow-hidden rounded-3xl border border-indigo-200/80 bg-gradient-to-r from-indigo-600 via-primary-600 to-violet-600 p-6 text-white shadow-elevated sm:p-8 animate-fade-in-up">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-950">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-950 animate-ping" />
                    Live Drop
                  </span>
                  <CountdownTimer endTime={activeFlashSale.endTime} />
                </div>
                <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl">
                  {activeFlashSale.name}
                </h2>
                {activeFlashSale.description && (
                  <p className="mt-1.5 text-sm text-indigo-100">{activeFlashSale.description}</p>
                )}
              </div>
              <Link to="/flash-sales" className="shrink-0">
                <Button size="lg" className="bg-white text-primary-700 hover:bg-slate-100 shadow-lg">
                  Shop Flash Drops
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </section>
        )}

        {/* Categories */}
        <section>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">Browse by Category</h2>
              <p className="mt-1 text-sm text-slate-500">Find essentials organized by department</p>
            </div>
            <Link
              to="/products"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
            >
              View full catalog
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {categoriesQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : categoriesQuery.isError ? (
            <ErrorState
              title="Could not load categories"
              onRetry={() => categoriesQuery.refetch()}
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {(categoriesQuery.data ?? []).map((cat, idx) => (
                <Link
                  key={cat.id}
                  to={`/categories/${cat.slug}`}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  className="group flex flex-col items-center justify-center rounded-2xl border border-slate-200/85 bg-white p-5 text-center shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-elevated animate-fade-in-up"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition-colors duration-200 group-hover:bg-primary-600 group-hover:text-white">
                    <Layers className="h-5 w-5" />
                  </div>
                  <span className="mt-3 text-sm font-bold text-slate-800 transition-colors group-hover:text-primary-700">
                    {cat.name}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Featured Products */}
        <section>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">Featured Arrivals</h2>
              <p className="mt-1 text-sm text-slate-500">Fresh additions across our most popular collections</p>
            </div>
            <Link to="/products">
              <Button variant="outline" size="sm">
                See All Products
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

        {/* Storefront Service Highlights */}
        <section className="grid grid-cols-1 gap-6 rounded-3xl border border-slate-200/85 bg-white p-8 shadow-soft md:grid-cols-3">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Verified Live Inventory</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                Available stock is held for 15 minutes during checkout so items in your order stay yours.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Express Nationwide Shipping</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                Free standard shipping across India with live status updates from warehouse dispatch to doorstep.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Easy Cancellations &amp; Refunds</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                Need to change plans? Cancel unpaid or eligible orders directly from your order history page.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
