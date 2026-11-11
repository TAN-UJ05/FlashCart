import api from './api';
import type { ApiResponse, Payment } from '../types';

export interface SimulatePaymentPayload {
  paymentId: string;
  transactionId?: string;
  outcome: 'SUCCEEDED' | 'FAILED' | 'TIMEOUT';
  failureReason?: string;
}

export async function initiatePayment(
  orderId: string,
  idempotencyKey?: string
): Promise<ApiResponse<Payment>> {
  const key = idempotencyKey ?? orderId;
  const { data } = await api.post<ApiResponse<Payment>>(
    '/payments/initiate',
    { orderId, idempotencyKey: key },
    { headers: { 'Idempotency-Key': key } }
  );
  return data;
}

export async function simulatePayment(
  payload: SimulatePaymentPayload
): Promise<ApiResponse<Payment>> {
  const { data } = await api.post<ApiResponse<Payment>>('/payments/callback', payload);
  return data;
}

export async function getPaymentsForOrder(orderId: string): Promise<ApiResponse<Payment[]>> {
  const { data } = await api.get<ApiResponse<Payment[]>>(`/payments/order/${orderId}`);
  return data;
}

export async function refundPayment(paymentId: string): Promise<ApiResponse<Payment>> {
  const { data } = await api.post<ApiResponse<Payment>>(`/payments/${paymentId}/refund`, {});
  return data;
}
