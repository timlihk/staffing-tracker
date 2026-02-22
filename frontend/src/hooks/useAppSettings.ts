import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

export interface AppSettings {
  id: number;
  enableDataExport: boolean;
  billingDateSweepEnabled: boolean;
  billingDateSweepLimit: number;
  billingAiSweepEnabled: boolean;
  billingAiSweepLimit: number;
  billingAiSweepBatchSize: number;
  billingAiSweepMinConfidence: number;
  billingAiSweepAutoConfirmConfidence: number;
  updatedAt: string;
  updatedBy: number | null;
}

export interface UpdateAppSettingsData {
  enableDataExport?: boolean;
  billingDateSweepEnabled?: boolean;
  billingDateSweepLimit?: number;
  billingAiSweepEnabled?: boolean;
  billingAiSweepLimit?: number;
  billingAiSweepBatchSize?: number;
  billingAiSweepMinConfidence?: number;
  billingAiSweepAutoConfirmConfidence?: number;
}

const APP_SETTINGS_KEY = ['app-settings'];

/**
 * Hook to fetch app settings
 */
export const useAppSettings = () => {
  return useQuery({
    queryKey: APP_SETTINGS_KEY,
    queryFn: async () => {
      const response = await api.get<AppSettings>('/app-settings');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to update app settings (admin only)
 */
export const useUpdateAppSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateAppSettingsData) => {
      const response = await api.patch<AppSettings>('/app-settings', data);
      return response.data;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: APP_SETTINGS_KEY });
    },
  });
};
