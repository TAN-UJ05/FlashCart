import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as userService from '../../services/user.service';
import { useToast } from '../../stores/toast.store';
import { extractErrorMessage, formatDate } from '../../utils/format';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Pagination } from '../../components/ui/Pagination';
import { SearchInput } from '../../components/ui/SearchInput';
import { TableRowSkeleton } from '../../components/ui/Skeleton';

export default function AdminCustomersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  const customersQuery = useQuery({
    queryKey: ['admin', 'customers', page, search],
    queryFn: async () => {
      const res = await userService.adminGetCustomers({
        page,
        size: 15,
        search: search || undefined,
      });
      return res.data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      userService.adminUpdateCustomerStatus(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] });
      toast({ title: 'Customer status updated', variant: 'success' });
    },
    onError: (err) => {
      toast({
        title: 'Failed to update status',
        description: extractErrorMessage(err),
        variant: 'error',
      });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="text-sm text-gray-500">View registered customer accounts and status</p>
      </div>

      <div className="max-w-sm">
        <SearchInput
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(0);
          }}
          placeholder="Search by name or email..."
          testId="admin-customer-search"
        />
      </div>

      {customersQuery.isError ? (
        <ErrorState title="Could not load customers" onRetry={() => customersQuery.refetch()} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customersQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                ) : (customersQuery.data?.content ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  (customersQuery.data?.content ?? []).map((cust) => (
                    <tr key={cust.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {cust.firstName} {cust.lastName ?? ''}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{cust.email}</td>
                      <td className="px-4 py-3 text-gray-600">{cust.phone || '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(cust.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={cust.enabled ? 'success' : 'danger'}>
                          {cust.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={toggleMutation.isPending}
                          onClick={() =>
                            toggleMutation.mutate({ id: cust.id, enabled: !cust.enabled })
                          }
                        >
                          {cust.enabled ? 'Disable' : 'Enable'}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {customersQuery.data && (
        <Pagination
          pageNumber={customersQuery.data.pageNumber}
          totalPages={customersQuery.data.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
