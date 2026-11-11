import api from './api';
import type { ApiResponse, Category } from '../types';

export interface CategoryPayload {
  name: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  active?: boolean;
  sortOrder?: number;
  parentId?: number | null;
}

export async function getCategories(): Promise<ApiResponse<Category[]>> {
  const { data } = await api.get<ApiResponse<Category[]>>('/categories');
  return data;
}

export async function getCategoryById(id: number): Promise<ApiResponse<Category>> {
  const { data } = await api.get<ApiResponse<Category>>(`/categories/${id}`);
  return data;
}

export async function getCategoryBySlug(slug: string): Promise<ApiResponse<Category>> {
  const { data } = await api.get<ApiResponse<Category>>(`/categories/slug/${slug}`);
  return data;
}

export async function adminGetCategories(): Promise<ApiResponse<Category[]>> {
  const { data } = await api.get<ApiResponse<Category[]>>('/admin/categories');
  return data;
}

export async function createCategory(payload: CategoryPayload): Promise<ApiResponse<Category>> {
  const { data } = await api.post<ApiResponse<Category>>('/admin/categories', payload);
  return data;
}

export async function updateCategory(
  id: number,
  payload: Partial<CategoryPayload>
): Promise<ApiResponse<Category>> {
  const { data } = await api.put<ApiResponse<Category>>(`/admin/categories/${id}`, payload);
  return data;
}

export async function deleteCategory(id: number): Promise<ApiResponse<void>> {
  const { data } = await api.delete<ApiResponse<void>>(`/admin/categories/${id}`);
  return data;
}
