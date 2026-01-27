import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import type { DashboardSummary } from '../types';

interface StaffingHeatmapResponse {
  staffingHeatmap: DashboardSummary['staffingHeatmap'];
}

export const useStaffingHeatmap = (
  days: number = 30,
  milestoneType: 'filing' | 'listing' | 'both' = 'both'
) => {
  return useQuery({
    queryKey: ['staffingHeatmap', days, milestoneType],
    queryFn: async () => {
      const response = await api.get<StaffingHeatmapResponse>('/dashboard/staffing-heatmap', {
        params: { days, milestoneType },
      });
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};
