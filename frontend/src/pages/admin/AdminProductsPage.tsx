import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import * as productService from '../../services/product.service';
import type { Product } from '../../types';
import { useToast } from '../../stores/toast.store';
import { extractErrorMessage, formatCurrency, getPrimaryImageUrl } from '../../utils/format';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ErrorState } from '../../components/ui/ErrorState';
import { Pagination } from '../../components/ui/Pagination';
import { SearchInput } from '../../components/ui/SearchInput';
import { TableRowSkeleton } from '../../components/ui/Skeleton';

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const productsQuery = useQuery({
    queryKey: ['admin', 'products', page, search],
    queryFn: async () => {
      const res = await productService.adminGetProducts({
        page,
        size: 15,
        search: search || undefined,
      });
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productService.deleteProduct(id),
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['flash-sales'] });
      toast({ title: 'Product deactivated', variant: 'info' });
    },
    onError: (err) => {
      toast({
        title: 'Action failed',
        description: extractErrorMessage(err),
        variant: 'error',
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">Manage catalog items, pricing, and images</p>
        </div>
        <Link to="/admin/products/new" data-testid="create-product-button">
          <Button>
            <Plus className="h-4 w-4" />
            Create Product
          </Button>
        </Link>
      </div>

      <div className="max-w-sm">
        <SearchInput
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(0);
          }}
          placeholder="Search products by name or SKU..."
          testId="admin-product-search"
        />
      </div>

      {productsQuery.isError ? (
        <ErrorState
          title="Could not load products"
          onRetry={() => productsQuery.refetch()}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {productsQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
                ) : (productsQuery.data?.content ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No products found.
                    </td>
                  </tr>
                ) : (
                  (productsQuery.data?.content ?? []).map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={getPrimaryImageUrl(p.images)}
                            alt={p.name}
                            className="h-10 w-10 rounded-lg object-cover bg-gray-100"
                          />
                          <span className="font-medium text-gray-900">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.sku}</td>
                      <td className="px-4 py-3 text-gray-600">{p.categoryName || '-'}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(p.price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            p.availableStock <= 5 ? 'font-semibold text-red-600' : 'text-gray-700'
                          }
                        >
                          {p.availableStock}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={p.active ? 'success' : 'default'}>
                          {p.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link
                            to={`/admin/products/${p.id}/edit`}
                            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(p)}
                            className="rounded p-1.5 text-red-500 hover:bg-red-50"
                            title="Deactivate"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {productsQuery.data && (
        <Pagination
          pageNumber={productsQuery.data.pageNumber}
          totalPages={productsQuery.data.totalPages}
          onPageChange={setPage}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Deactivate Product?"
        message={`Are you sure you want to deactivate "${deleteTarget?.name ?? ''}"?`}
        confirmText="Deactivate"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
