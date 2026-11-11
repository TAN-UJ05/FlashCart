import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Zap } from 'lucide-react';
import * as flashSaleService from '../../services/flashsale.service';
import * as productService from '../../services/product.service';
import { useToast } from '../../stores/toast.store';
import { extractErrorMessage, formatCurrency, formatDateTime } from '../../utils/format';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { TableRowSkeleton } from '../../components/ui/Skeleton';

interface DraftItem {
  productId: string;
  salePrice: string;
  saleStock: string;
}

export default function AdminFlashSalesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState(() => new Date().toISOString().slice(0, 16));
  const [endTime, setEndTime] = useState(() =>
    new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [items, setItems] = useState<DraftItem[]>([
    { productId: '', salePrice: '999', saleStock: '100' },
  ]);

  const salesQuery = useQuery({
    queryKey: ['admin', 'flash-sales'],
    queryFn: async () => {
      const res = await flashSaleService.adminGetFlashSales();
      return res.data;
    },
  });

  const productsQuery = useQuery({
    queryKey: ['admin', 'products', 'all-for-select'],
    queryFn: async () => {
      const res = await productService.adminGetProducts({ page: 0, size: 100 });
      return res.data.content;
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      flashSaleService.adminCreateFlashSale({
        name,
        description: description || undefined,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        active: true,
        items: items
          .filter((i) => i.productId)
          .map((i) => ({
            productId: i.productId,
            salePrice: Number(i.salePrice),
            saleStock: Number(i.saleStock),
          })),
      }),
    onSuccess: () => {
      setCreateOpen(false);
      setName('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'flash-sales'] });
      queryClient.invalidateQueries({ queryKey: ['flash-sales'] });
      toast({ title: 'Flash sale created', variant: 'success' });
    },
    onError: (err) => {
      toast({
        title: 'Could not create flash sale',
        description: extractErrorMessage(err),
        variant: 'error',
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => flashSaleService.adminDeactivateFlashSale(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'flash-sales'] });
      toast({ title: 'Flash sale deactivated', variant: 'info' });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flash Sales</h1>
          <p className="text-sm text-gray-500">
            Configure high-concurrency campaigns and per-SKU sale stock caps
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Flash Sale
        </Button>
      </div>

      {salesQuery.isError ? (
        <ErrorState title="Could not load flash sales" onRetry={() => salesQuery.refetch()} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Window</th>
                  <th className="px-4 py-3">Items &amp; Stats</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {salesQuery.isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)
                ) : (salesQuery.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No flash sales configured.
                    </td>
                  </tr>
                ) : (
                  (salesQuery.data ?? []).map((sale) => (
                    <tr key={sale.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-semibold text-gray-900">
                          <Zap className="h-4 w-4 text-primary-600" />
                          {sale.name}
                        </div>
                        {sale.description && (
                          <p className="text-xs text-gray-500">{sale.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        <div>Start: {formatDateTime(sale.startTime)}</div>
                        <div>End: {formatDateTime(sale.endTime)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1 text-xs">
                          {sale.items.map((item) => (
                            <div key={item.id} className="text-gray-700">
                              {item.productName}: <strong>{formatCurrency(item.salePrice)}</strong> ({item.soldCount}/{item.saleStock} sold)
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={sale.live ? 'success' : sale.active ? 'warning' : 'default'}>
                          {sale.live ? 'Live' : sale.active ? 'Scheduled' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {sale.active && (
                          <button
                            type="button"
                            onClick={() => deactivateMutation.mutate(sale.id)}
                            className="rounded p-1.5 text-red-500 hover:bg-red-50"
                            title="Deactivate"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Flash Sale Campaign"
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-4">
          <Input
            label="Campaign Name"
            placeholder="Midnight Mega Drop"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Description"
            placeholder="Limited 100-unit flash deal"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Start Time"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <Input
              label="End Time"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Sale Items</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    { productId: '', salePrice: '499', saleStock: '50' },
                  ])
                }
              >
                + Add Item
              </Button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                <select
                  value={item.productId}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx] = { ...next[idx], productId: e.target.value };
                    setItems(next);
                  }}
                  className="sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select product...</option>
                  {(productsQuery.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (₹{p.price})
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  placeholder="Sale ₹"
                  value={item.salePrice}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx] = { ...next[idx], salePrice: e.target.value };
                    setItems(next);
                  }}
                />
                <Input
                  type="number"
                  placeholder="Stock"
                  value={item.saleStock}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx] = { ...next[idx], saleStock: e.target.value };
                    setItems(next);
                  }}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              isLoading={createMutation.isPending}
              disabled={!name || items.every((i) => !i.productId)}
              onClick={() => createMutation.mutate()}
            >
              Launch Flash Sale
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
