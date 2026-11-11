import api from './api';
import type { ApiResponse, Order, OrderStatus, PageResponse } from '../types';

export interface CheckoutPayload {
  addressId?: string;
  shippingFullName?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  shippingPhone?: string;
  notes?: string;
  idempotencyKey?: string;
}

export async function checkout(payload: CheckoutPayload): Promise<ApiResponse<Order>> {
  const { data } = await api.post<ApiResponse<Order>>('/orders/checkout', payload, {
    headers: payload.idempotencyKey ? { 'Idempotency-Key': payload.idempotencyKey } : undefined,
  });
  return data;
}

export async function getOrders(params?: {
  page?: number;
  size?: number;
}): Promise<ApiResponse<PageResponse<Order>>> {
  const { data } = await api.get<ApiResponse<PageResponse<Order>>>('/orders', { params });
  return data;
}

export async function getOrder(id: string): Promise<ApiResponse<Order>> {
  const { data } = await api.get<ApiResponse<Order>>(`/orders/${id}`);
  return data;
}

export async function cancelOrder(id: string): Promise<ApiResponse<Order>> {
  const { data } = await api.post<ApiResponse<Order>>(`/orders/${id}/cancel`, {});
  return data;
}

export async function adminGetOrders(params?: {
  page?: number;
  size?: number;
  status?: OrderStatus | '';
}): Promise<ApiResponse<PageResponse<Order>>> {
  const cleanParams = params?.status ? params : { page: params?.page, size: params?.size };
  const { data } = await api.get<ApiResponse<PageResponse<Order>>>('/admin/orders', {
    params: cleanParams,
  });
  return data;
}

export async function adminUpdateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<ApiResponse<Order>> {
  const { data } = await api.patch<ApiResponse<Order>>(`/admin/orders/${id}/status`, { status });
  return data;
}
