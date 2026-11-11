import api from './api';
import type { ApiResponse, PageResponse, Product, ProductImage } from '../types';

export interface ProductQueryParams {
  page?: number;
  size?: number;
  categoryId?: number;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface ProductFormPayload {
  name: string;
  sku: string;
  description?: string;
  price: number;
  compareAtPrice?: number | null;
  categoryId?: number | null;
  active: boolean;
  initialStock?: number;
  imageUrl?: string;
}

export async function getProducts(
  params?: ProductQueryParams
): Promise<ApiResponse<PageResponse<Product>>> {
  const { data } = await api.get<ApiResponse<PageResponse<Product>>>('/products', { params });
  return data;
}

export async function getProduct(id: string): Promise<ApiResponse<Product>> {
  const { data } = await api.get<ApiResponse<Product>>(`/products/${id}`);
  return data;
}

export async function searchProducts(
  q: string,
  page = 0,
  size = 12
): Promise<ApiResponse<PageResponse<Product>>> {
  const { data } = await api.get<ApiResponse<PageResponse<Product>>>('/products/search', {
    params: { q, page, size },
  });
  return data;
}

export async function adminGetProducts(params?: {
  page?: number;
  size?: number;
  search?: string;
  categoryId?: number;
}): Promise<ApiResponse<PageResponse<Product>>> {
  const { data } = await api.get<ApiResponse<PageResponse<Product>>>('/admin/products', { params });
  return data;
}

export async function createProduct(payload: ProductFormPayload): Promise<ApiResponse<Product>> {
  const { data } = await api.post<ApiResponse<Product>>('/admin/products', payload);
  return data;
}

export async function updateProduct(
  id: string,
  payload: ProductFormPayload
): Promise<ApiResponse<Product>> {
  const { data } = await api.put<ApiResponse<Product>>(`/admin/products/${id}`, payload);
  return data;
}

export async function deleteProduct(id: string): Promise<ApiResponse<void>> {
  const { data } = await api.delete<ApiResponse<void>>(`/admin/products/${id}`);
  return data;
}

export async function uploadProductImage(
  productId: string,
  file: File,
  isPrimary = false,
  altText?: string
): Promise<ApiResponse<ProductImage>> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('isPrimary', String(isPrimary));
  if (altText) {
    formData.append('altText', altText);
  }
  const { data } = await api.post<ApiResponse<ProductImage>>(
    `/admin/products/${productId}/images`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return data;
}

export async function deleteProductImage(
  productId: string,
  imageId: string
): Promise<ApiResponse<void>> {
  const { data } = await api.delete<ApiResponse<void>>(
    `/admin/products/${productId}/images/${imageId}`
  );
  return data;
}
