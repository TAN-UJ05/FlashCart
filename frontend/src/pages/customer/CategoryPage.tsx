import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import * as categoryService from '../../services/category.service';
import * as productService from '../../services/product.service';
import { ProductGrid } from '../../components/product/ProductGrid';
import { Pagination } from '../../components/ui/Pagination';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState(0);

  const categoryQuery = useQuery({
    queryKey: ['category', slug],
    queryFn: async () => {
      const res = await categoryService.getCategoryBySlug(slug!);
      return res.data;
    },
    enabled: !!slug,
  });

  const productsQuery = useQuery({
    queryKey: ['products', 'category', categoryQuery.data?.id, page],
    queryFn: async () => {
      const res = await productService.getProducts({
        categoryId: categoryQuery.data!.id,
        page,
        size: 12,
      });
      return res.data;
    },
    enabled: !!categoryQuery.data?.id,
  });

  if (categoryQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <ProductGrid products={[]} isLoading />
      </div>
    );
  }

  if (categoryQuery.isError || !categoryQuery.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorState
          title="Category not found"
          onRetry={() => categoryQuery.refetch()}
        />
      </div>
    );
  }

  const category = categoryQuery.data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <Link
        to="/products"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        All Categories
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">{category.name}</h1>
        {category.description && (
          <p className="mt-1 text-sm text-gray-500">{category.description}</p>
        )}
      </div>

      {productsQuery.isError ? (
        <ErrorState
          title="Could not load products"
          onRetry={() => productsQuery.refetch()}
        />
      ) : (
        <>
          <ProductGrid
            products={productsQuery.data?.content ?? []}
            isLoading={productsQuery.isLoading}
            emptyTitle={`No products in ${category.name} yet`}
          />
          {productsQuery.data && (
            <Pagination
              pageNumber={productsQuery.data.pageNumber}
              totalPages={productsQuery.data.totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
