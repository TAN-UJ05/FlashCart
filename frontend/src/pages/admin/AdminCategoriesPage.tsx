import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import * as categoryService from '../../services/category.service';
import type { Category } from '../../types';
import { useToast } from '../../stores/toast.store';
import { extractErrorMessage } from '../../utils/format';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ErrorState } from '../../components/ui/ErrorState';
import { TableRowSkeleton } from '../../components/ui/Skeleton';

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  slug: z.string().max(100).optional(),
  description: z.string().optional(),
  sortOrder: z
    .number({ error: 'Sort order is required' })
    .int('Sort order must be a whole number')
    .min(0, 'Sort order must be >= 0'),
  active: z.boolean(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: async () => {
      const res = await categoryService.adminGetCategories();
      return res.data;
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', slug: '', description: '', sortOrder: 0, active: true },
  });

  const saveMutation = useMutation({
    mutationFn: (values: CategoryFormValues) =>
      editing
        ? categoryService.updateCategory(editing.id, values)
        : categoryService.createCategory(values),
    onSuccess: () => {
      setModalOpen(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: editing ? 'Category updated' : 'Category created', variant: 'success' });
    },
    onError: (err) => {
      toast({ title: 'Save failed', description: extractErrorMessage(err), variant: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => categoryService.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Category deactivated', variant: 'info' });
    },
    onError: (err) => {
      toast({ title: 'Action failed', description: extractErrorMessage(err), variant: 'error' });
    },
  });

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', slug: '', description: '', sortOrder: 0, active: true });
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    reset({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? '',
      sortOrder: cat.sortOrder,
      active: cat.active,
    });
    setModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            Taxonomy
          </span>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">
            Categories
          </h1>
          <p className="text-sm text-slate-500">Organize catalog taxonomy and display order</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      </div>

      {categoriesQuery.isError ? (
        <ErrorState title="Could not load categories" onRetry={() => categoriesQuery.refetch()} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Name</th>
                <th className="px-4 py-3.5">Slug</th>
                <th className="px-4 py-3.5">Sort</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categoriesQuery.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)
              ) : (
                (categoriesQuery.data ?? []).map((cat) => (
                  <tr key={cat.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-900">{cat.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{cat.slug}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{cat.sortOrder}</td>
                    <td className="px-4 py-3">
                      <Badge variant={cat.active ? 'success' : 'default'}>
                        {cat.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(cat)}
                          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(cat.id)}
                          className="rounded-lg p-1.5 text-rose-500 transition-colors hover:bg-rose-50"
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
        </Card>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Category' : 'Create Category'}
      >
        <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
          <Input
            label="Name"
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="Slug (optional, auto-generated if blank)"
            error={errors.slug?.message}
            {...register('slug')}
          />
          <Input
            label="Description"
            {...register('description')}
          />
          <Input
            label="Sort Order"
            type="number"
            error={errors.sortOrder?.message}
            {...register('sortOrder', {
              setValueAs: (v) =>
                v === '' || v === null || v === undefined ? undefined : Number(v),
            })}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" {...register('active')} className="accent-primary-600" />
            Active
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              Save Category
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
