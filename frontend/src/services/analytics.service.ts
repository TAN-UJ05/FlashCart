import api from './api';
import type { AnalyticsDashboard, ApiResponse } from '../types';

export async function getDashboardAnalytics(days = 30): Promise<ApiResponse<AnalyticsDashboard>> {
  const { data } = await api.get<ApiResponse<AnalyticsDashboard>>('/admin/analytics/dashboard', {
    params: { days },
  });
  return data;
}
