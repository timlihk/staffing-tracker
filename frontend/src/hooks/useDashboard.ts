import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import type { DashboardSummary } from '../types';

export const useDashboard = (days: number = 30, milestoneType: 'filing' | 'listing' | 'both' = 'both') => {
  return useQuery({
    queryKey: ['dashboard', days, milestoneType],
    queryFn: async () => {
      const response = await api.get<DashboardSummary>('/dashboard/summary', {
        params: { days, milestoneType },
      });
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes (dashboard updates frequently)
  });
};
