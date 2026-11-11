import api from './api';
import type { ApiResponse, AuthTokenResponse, User } from '../types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
  phone?: string;
}

export async function login(payload: LoginPayload): Promise<ApiResponse<AuthTokenResponse>> {
  const { data } = await api.post<ApiResponse<AuthTokenResponse>>('/auth/login', payload);
  return data;
}

export async function register(payload: RegisterPayload): Promise<ApiResponse<AuthTokenResponse>> {
  const { data } = await api.post<ApiResponse<AuthTokenResponse>>('/auth/register', payload);
  return data;
}

export async function logout(): Promise<ApiResponse<void>> {
  const { data } = await api.post<ApiResponse<void>>('/auth/logout', {});
  return data;
}

export async function refreshToken(): Promise<ApiResponse<{ accessToken: string }>> {
  const { data } = await api.post<ApiResponse<{ accessToken: string }>>('/auth/refresh', {});
  return data;
}

export async function forgotPassword(email: string): Promise<ApiResponse<void>> {
  const { data } = await api.post<ApiResponse<void>>('/auth/forgot-password', { email });
  return data;
}

export async function resetPassword(token: string, newPassword: string): Promise<ApiResponse<void>> {
  const { data } = await api.post<ApiResponse<void>>('/auth/reset-password', {
    token,
    newPassword,
  });
  return data;
}

export async function getCurrentUser(): Promise<ApiResponse<User>> {
  const { data } = await api.get<ApiResponse<User>>('/auth/me');
  return data;
}
