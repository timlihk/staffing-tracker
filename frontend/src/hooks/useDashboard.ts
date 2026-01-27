import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import type { DashboardSummary } from '../types';

export const useDashboard = (days: number = 30) => {
  return useQuery({
    queryKey: ['dashboard', days],
    queryFn: async () => {
      const response = await api.get<DashboardSummary>('/dashboard/summary', {
        params: { days },
      });
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes (dashboard updates frequently)
  });
};
