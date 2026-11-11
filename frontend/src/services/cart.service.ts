import api from './api';
import type { ApiResponse, Cart } from '../types';

export async function getCart(): Promise<ApiResponse<Cart>> {
  const { data } = await api.get<ApiResponse<Cart>>('/cart');
  return data;
}

export async function addItem(productId: string, quantity = 1): Promise<ApiResponse<Cart>> {
  const { data } = await api.post<ApiResponse<Cart>>('/cart/items', { productId, quantity });
  return data;
}

export async function updateItem(productId: string, quantity: number): Promise<ApiResponse<Cart>> {
  const { data } = await api.put<ApiResponse<Cart>>(`/cart/items/${productId}`, { quantity });
  return data;
}

export async function removeItem(productId: string): Promise<ApiResponse<Cart>> {
  const { data } = await api.delete<ApiResponse<Cart>>(`/cart/items/${productId}`);
  return data;
}

export async function clearCart(): Promise<ApiResponse<void>> {
  const { data } = await api.delete<ApiResponse<void>>('/cart');
  return data;
}
