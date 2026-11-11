import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as productService from '../../services/product.service';
import * as categoryService from '../../services/category.service';
import { ProductGrid } from '../../components/product/ProductGrid';
import {
  ProductFilters,
  type ProductFilterValues,
} from '../../components/product/ProductFilters';
import { Pagination } from '../../components/ui/Pagination';
import { ErrorState } from '../../components/ui/ErrorState';

const initialFilters: ProductFilterValues = {
  categoryId: undefined,
  minPrice: '',
  maxPrice: '',
  sortBy: 'createdAt',
  sortDir: 'desc',
};

export default function ProductListPage() {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<ProductFilterValues>(initialFilters);

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await categoryService.getCategories();
      return res.data;
    },
  });

  const productsQuery = useQuery({
    queryKey: ['products', page, filters],
    queryFn: async () => {
      const res = await productService.getProducts({
        page,
        size: 12,
        categoryId: filters.categoryId,
        minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
        maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
      });
      return res.data;
    },
  });

  const handleFilterChange = (next: ProductFilterValues) => {
    setFilters(next);
    setPage(0);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">All Products</h1>
        <p className="mt-1 text-sm text-gray-500">
          {productsQuery.data
            ? `Showing ${productsQuery.data.content.length} of ${productsQuery.data.totalElements} products`
            : 'Explore our full catalog'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <ProductFilters
            categories={categoriesQuery.data ?? []}
            filters={filters}
            onChange={handleFilterChange}
            onReset={() => handleFilterChange(initialFilters)}
          />
        </div>

        <div className="lg:col-span-3 space-y-6">
          {productsQuery.isError ? (
            <ErrorState
              title="Failed to load products"
              onRetry={() => productsQuery.refetch()}
            />
          ) : (
            <>
              <ProductGrid
                products={productsQuery.data?.content ?? []}
                isLoading={productsQuery.isLoading}
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
      </div>
    </div>
  );
}
