import api from './api';
import type { Address, ApiResponse, PageResponse, User } from '../types';

export interface UpdateProfilePayload {
  firstName: string;
  lastName?: string;
  phone?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface AddressPayload {
  fullName: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

export async function getProfile(): Promise<ApiResponse<User>> {
  const { data } = await api.get<ApiResponse<User>>('/users/me');
  return data;
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<ApiResponse<User>> {
  const { data } = await api.put<ApiResponse<User>>('/users/me', payload);
  return data;
}

export async function changePassword(payload: ChangePasswordPayload): Promise<ApiResponse<void>> {
  const { data } = await api.put<ApiResponse<void>>('/users/me/password', payload);
  return data;
}

export async function getAddresses(): Promise<ApiResponse<Address[]>> {
  const { data } = await api.get<ApiResponse<Address[]>>('/users/me/addresses');
  return data;
}

export async function createAddress(payload: AddressPayload): Promise<ApiResponse<Address>> {
  const { data } = await api.post<ApiResponse<Address>>('/users/me/addresses', payload);
  return data;
}

export async function updateAddress(id: string, payload: AddressPayload): Promise<ApiResponse<Address>> {
  const { data } = await api.put<ApiResponse<Address>>(`/users/me/addresses/${id}`, payload);
  return data;
}

export async function deleteAddress(id: string): Promise<ApiResponse<void>> {
  const { data } = await api.delete<ApiResponse<void>>(`/users/me/addresses/${id}`);
  return data;
}

export async function adminGetCustomers(params?: {
  page?: number;
  size?: number;
  search?: string;
}): Promise<ApiResponse<PageResponse<User>>> {
  const { data } = await api.get<ApiResponse<PageResponse<User>>>('/admin/customers', { params });
  return data;
}

export async function adminUpdateCustomerStatus(
  id: string,
  enabled: boolean
): Promise<ApiResponse<User>> {
  const { data } = await api.patch<ApiResponse<User>>(`/admin/customers/${id}/status`, { enabled });
  return data;
}
