import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import * as inventoryService from '../../services/inventory.service';
import type { InventoryItem } from '../../types';
import { useToast } from '../../stores/toast.store';
import { extractErrorMessage } from '../../utils/format';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { TableRowSkeleton } from '../../components/ui/Skeleton';

export default function AdminInventoryPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [adjustmentValue, setAdjustmentValue] = useState('0');
  const [reason, setReason] = useState('');

  const inventoryQuery = useQuery({
    queryKey: ['admin', 'inventory', page],
    queryFn: async () => {
      const res = await inventoryService.getInventoryList({ page, size: 20 });
      return res.data;
    },
  });

  const parsedAdjustment = Number(adjustmentValue);
  const isAdjustmentValid =
    adjustmentValue.trim() !== '' && Number.isInteger(parsedAdjustment) && parsedAdjustment !== 0;

  const adjustMutation = useMutation({
    mutationFn: () => {
      if (!isAdjustmentValid) {
        throw new Error('Adjustment must be a non-zero whole number.');
      }
      return inventoryService.adjustStock(selected!.productId, {
        adjustment: parsedAdjustment,
        reason: reason.trim() || undefined,
      });
    },
    onSuccess: () => {
      setSelected(null);
      setAdjustmentValue('0');
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      toast({ title: 'Inventory updated', variant: 'success' });
    },
    onError: (err) => {
      toast({
        title: 'Stock adjustment failed',
        description: extractErrorMessage(err),
        variant: 'error',
      });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
        <p className="text-sm text-gray-500">
          Monitor total, reserved, and available stock invariants across all SKUs
        </p>
      </div>

      {inventoryQuery.isError ? (
        <ErrorState
          title="Could not load inventory"
          onRetry={() => inventoryQuery.refetch()}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Reserved</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inventoryQuery.isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
                ) : (
                  (inventoryQuery.data?.content ?? []).map((item) => {
                    const isOut = item.availableStock <= 0;
                    const isLow = item.availableStock > 0 && item.availableStock <= 10;
                    return (
                      <tr key={item.id} className={isLow || isOut ? 'bg-red-50/40' : ''}>
                        <td className="px-4 py-3 font-medium text-gray-900">{item.productName}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.productSku}</td>
                        <td className="px-4 py-3 text-right">{item.totalStock}</td>
                        <td className="px-4 py-3 text-right text-amber-700 font-medium">
                          {item.reservedStock}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">
                          {item.availableStock}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={isOut ? 'danger' : isLow ? 'warning' : 'success'}>
                            {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelected(item);
                              setAdjustmentValue('10');
                              setReason('');
                            }}
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            Adjust
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {inventoryQuery.data && (
        <Pagination
          pageNumber={inventoryQuery.data.pageNumber}
          totalPages={inventoryQuery.data.totalPages}
          onPageChange={setPage}
        />
      )}

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={`Adjust Stock: ${selected?.productName ?? ''}`}
        description={`Current total: ${selected?.totalStock ?? 0}, Reserved: ${selected?.reservedStock ?? 0}`}
      >
        <div className="space-y-4">
          <Input
            label="Stock Adjustment (+/- delta)"
            type="number"
            value={adjustmentValue}
            onChange={(e) => setAdjustmentValue(e.target.value)}
            helperText="Use positive numbers to restock or negative numbers to deduct."
          />
          <Input
            label="Reason (Optional)"
            placeholder="Restock shipment #123"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button
              disabled={!isAdjustmentValid}
              isLoading={adjustMutation.isPending}
              onClick={() => adjustMutation.mutate()}
            >
              Apply Adjustment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
