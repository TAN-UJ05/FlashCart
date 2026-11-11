import { useMemo, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Trash2, Upload } from 'lucide-react';
import * as productService from '../../services/product.service';
import * as categoryService from '../../services/category.service';
import { useToast } from '../../stores/toast.store';
import { extractErrorMessage } from '../../utils/format';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(255),
  sku: z.string().min(1, 'SKU is required').max(100),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be >= 0'),
  compareAtPrice: z.number().min(0).nullable().optional(),
  categoryId: z.number().nullable().optional(),
  active: z.boolean(),
  initialStock: z.number().min(0).optional(),
  imageUrl: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function AdminProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: async () => {
      const res = await categoryService.adminGetCategories();
      return res.data;
    },
  });

  const productQuery = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const res = await productService.getProduct(id!);
      return res.data;
    },
    enabled: isEdit,
  });

  const existing = productQuery.data;

  const existingValues = useMemo<ProductFormValues | undefined>(
    () =>
      existing
        ? {
            name: existing.name,
            sku: existing.sku,
            description: existing.description ?? '',
            price: existing.price,
            compareAtPrice: existing.compareAtPrice ?? null,
            categoryId: existing.categoryId ?? null,
            active: existing.active,
            initialStock: existing.totalStock,
            imageUrl: existing.images?.[0]?.imageUrl ?? '',
          }
        : undefined,
    [existing]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      sku: '',
      description: '',
      price: 0,
      compareAtPrice: null,
      categoryId: null,
      active: true,
      initialStock: 50,
      imageUrl: '',
    },
    values: existingValues,
    resetOptions: {
      keepDirtyValues: true,
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const payload = {
        name: values.name,
        sku: values.sku,
        description: values.description || undefined,
        price: values.price,
        compareAtPrice:
          values.compareAtPrice !== null && !Number.isNaN(values.compareAtPrice)
            ? values.compareAtPrice
            : null,
        categoryId:
          values.categoryId !== null && !Number.isNaN(values.categoryId)
            ? values.categoryId
            : null,
        active: values.active,
        initialStock: isEdit ? undefined : values.initialStock ?? 0,
        imageUrl: values.imageUrl || undefined,
      };
      const res = isEdit
        ? await productService.updateProduct(id!, payload)
        : await productService.createProduct(payload);

      if (selectedFile && res.data.id) {
        await productService.uploadProductImage(res.data.id, selectedFile, true, values.name);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (id) {
        queryClient.invalidateQueries({ queryKey: ['product', id] });
      }
      toast({
        title: isEdit ? 'Product updated' : 'Product created',
        variant: 'success',
      });
      navigate('/admin/products');
    },
    onError: (err) => {
      toast({
        title: 'Save failed',
        description: extractErrorMessage(err),
        variant: 'error',
      });
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: (imageId: string) => productService.deleteProductImage(id!, imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      toast({ title: 'Image removed', variant: 'info' });
    },
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  if (isEdit && productQuery.isLoading) {
    return <Skeleton className="h-96 w-full max-w-3xl rounded-xl" />;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        to="/admin/products"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Products
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? 'Edit Product' : 'Create Product'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Product Name"
                placeholder="Wireless Mechanical Keyboard"
                error={errors.name?.message}
                {...register('name')}
              />
              <Input
                label="SKU"
                placeholder="SKU-KB-001"
                error={errors.sku?.message}
                {...register('sku')}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="Product features, specs, and details..."
                {...register('description')}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="Price (₹)"
                type="number"
                step="0.01"
                error={errors.price?.message}
                {...register('price', { valueAsNumber: true })}
              />
              <Input
                label="Compare-At Price (₹)"
                type="number"
                step="0.01"
                error={errors.compareAtPrice?.message}
                {...register('compareAtPrice', {
                  setValueAs: (v) => (v === '' || v === null ? null : Number(v)),
                })}
              />
              {!isEdit && (
                <Input
                  label="Initial Stock"
                  type="number"
                  error={errors.initialStock?.message}
                  {...register('initialStock', { valueAsNumber: true })}
                />
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Category
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none"
                  {...register('categoryId', {
                    setValueAs: (v) => (v === '' || v === null ? null : Number(v)),
                  })}
                >
                  <option value="">Uncategorized</option>
                  {(categoriesQuery.data ?? []).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Image URL (Optional)"
                placeholder="https://..."
                {...register('imageUrl')}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Upload Product Image (PNG, JPEG, WebP)
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600 hover:bg-gray-100">
                <Upload className="h-4 w-4 text-gray-500" />
                <span>{selectedFile ? selectedFile.name : 'Choose an image file to upload...'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {isEdit && existing?.images && existing.images.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500">Existing Images</p>
                <div className="flex flex-wrap gap-3">
                  {existing.images.map((img) => (
                    <div key={img.id} className="relative h-20 w-20 overflow-hidden rounded-lg border">
                      <img src={img.imageUrl} alt={img.altText ?? ''} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => deleteImageMutation.mutate(img.id)}
                        className="absolute right-1 top-1 rounded bg-white/90 p-1 text-red-600 shadow"
                        title="Remove image"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input type="checkbox" {...register('active')} />
              Active (visible in storefront)
            </label>

            <div className="flex justify-end gap-3 pt-4">
              <Link to="/admin/products">
                <Button variant="outline">Cancel</Button>
              </Link>
              <Button
                type="submit"
                isLoading={saveMutation.isPending}
                data-testid="save-product-button"
              >
                {isEdit ? 'Update Product' : 'Save Product'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
