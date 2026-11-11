import api from './api';
import type { ApiResponse, FlashSale, Order } from '../types';

export interface FlashSalePurchasePayload {
  productId: string;
  quantity: number;
  idempotencyKey: string;
  addressId?: string;
  shippingFullName?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  shippingPhone?: string;
}

export interface FlashSaleItemPayload {
  productId: string;
  salePrice: number;
  saleStock: number;
}

export interface CreateFlashSalePayload {
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  active: boolean;
  items: FlashSaleItemPayload[];
}

export async function getActiveFlashSales(): Promise<ApiResponse<FlashSale[]>> {
  const { data } = await api.get<ApiResponse<FlashSale[]>>('/flash-sales');
  return data;
}

export async function getLiveFlashSales(): Promise<ApiResponse<FlashSale[]>> {
  const { data } = await api.get<ApiResponse<FlashSale[]>>('/flash-sales/live');
  return data;
}

export async function getFlashSale(id: string): Promise<ApiResponse<FlashSale>> {
  const { data } = await api.get<ApiResponse<FlashSale>>(`/flash-sales/${id}`);
  return data;
}

export async function purchaseFlashSaleItem(
  flashSaleId: string,
  payload: FlashSalePurchasePayload
): Promise<ApiResponse<Order>> {
  const { data } = await api.post<ApiResponse<Order>>(
    `/flash-sales/${flashSaleId}/purchase`,
    payload,
    { headers: { 'Idempotency-Key': payload.idempotencyKey } }
  );
  return data;
}

export async function adminGetFlashSales(): Promise<ApiResponse<FlashSale[]>> {
  const { data } = await api.get<ApiResponse<FlashSale[]>>('/admin/flash-sales');
  return data;
}

export async function adminCreateFlashSale(
  payload: CreateFlashSalePayload
): Promise<ApiResponse<FlashSale>> {
  const { data } = await api.post<ApiResponse<FlashSale>>('/admin/flash-sales', payload);
  return data;
}

export async function adminUpdateFlashSale(
  id: string,
  payload: CreateFlashSalePayload
): Promise<ApiResponse<FlashSale>> {
  const { data } = await api.put<ApiResponse<FlashSale>>(`/admin/flash-sales/${id}`, payload);
  return data;
}

export async function adminAddFlashSaleItem(
  id: string,
  payload: FlashSaleItemPayload
): Promise<ApiResponse<FlashSale>> {
  const { data } = await api.post<ApiResponse<FlashSale>>(
    `/admin/flash-sales/${id}/items`,
    payload
  );
  return data;
}

export async function adminDeactivateFlashSale(id: string): Promise<ApiResponse<void>> {
  const { data } = await api.delete<ApiResponse<void>>(`/admin/flash-sales/${id}`);
  return data;
}
