import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as productService from '../../services/product.service';
import { ProductGrid } from '../../components/product/ProductGrid';
import { Pagination } from '../../components/ui/Pagination';
import { ErrorState } from '../../components/ui/ErrorState';
import { SearchInput } from '../../components/ui/SearchInput';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [page, setPage] = useState(0);

  const searchQuery = useQuery({
    queryKey: ['products', 'search', query, page],
    queryFn: async () => {
      const res = await productService.searchProducts(query, page, 12);
      return res.data;
    },
    enabled: query.trim().length > 0,
  });

  const handleSubmit = (nextQuery: string) => {
    setPage(0);
    setSearchParams(nextQuery ? { q: nextQuery } : {});
  };

  return (
    <div
      data-testid="search-results"
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Search Results</h1>
          <p className="mt-1 text-sm text-gray-500">
            {query ? (
              <>
                Showing results for <span className="font-semibold text-gray-900">&ldquo;{query}&rdquo;</span>
              </>
            ) : (
              'Enter a keyword to search products'
            )}
          </p>
        </div>
        <div className="w-full sm:w-80">
          <SearchInput
            value={query}
            onSubmit={handleSubmit}
            testId="page-search-input"
            placeholder="Search products..."
          />
        </div>
      </div>

      {!query.trim() ? (
        <ProductGrid
          products={[]}
          emptyTitle="Start searching"
          emptyDescription="Type a product name or SKU in the search box above."
        />
      ) : searchQuery.isError ? (
        <ErrorState
          title="Search failed"
          onRetry={() => searchQuery.refetch()}
        />
      ) : (
        <>
          <ProductGrid
            products={searchQuery.data?.content ?? []}
            isLoading={searchQuery.isLoading}
            emptyTitle="No matching products"
            emptyDescription={`No products found matching "${query}". Try a different search term.`}
          />
          {searchQuery.data && (
            <Pagination
              pageNumber={searchQuery.data.pageNumber}
              totalPages={searchQuery.data.totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
