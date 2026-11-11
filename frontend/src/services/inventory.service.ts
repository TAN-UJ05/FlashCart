import api from './api';
import type { ApiResponse, InventoryItem, PageResponse } from '../types';

export async function getInventoryList(params?: {
  page?: number;
  size?: number;
}): Promise<ApiResponse<PageResponse<InventoryItem>>> {
  const { data } = await api.get<ApiResponse<PageResponse<InventoryItem>>>('/admin/inventory', {
    params,
  });
  return data;
}

export async function getLowStockItems(threshold = 10): Promise<ApiResponse<InventoryItem[]>> {
  const { data } = await api.get<ApiResponse<InventoryItem[]>>('/admin/inventory/low-stock', {
    params: { threshold },
  });
  return data;
}

export async function getInventoryByProduct(productId: string): Promise<ApiResponse<InventoryItem>> {
  const { data } = await api.get<ApiResponse<InventoryItem>>(
    `/admin/inventory/product/${productId}`
  );
  return data;
}

export async function adjustStock(
  productId: string,
  payload: { adjustment?: number; newTotalStock?: number; reason?: string }
): Promise<ApiResponse<InventoryItem>> {
  const { data } = await api.put<ApiResponse<InventoryItem>>(
    `/admin/inventory/product/${productId}/adjust`,
    payload
  );
  return data;
}
