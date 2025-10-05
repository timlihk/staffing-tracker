import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

export interface EmailSettings {
  id: number;
  emailNotificationsEnabled: boolean;
  notifyPartner: boolean;
  notifyAssociate: boolean;
  notifyJuniorFlic: boolean;
  notifySeniorFlic: boolean;
  notifyIntern: boolean;
  notifyBCWorkingAttorney: boolean;
  updatedAt: string;
  updatedBy: number | null;
}

export interface UpdateEmailSettingsPayload {
  emailNotificationsEnabled?: boolean;
  notifyPartner?: boolean;
  notifyAssociate?: boolean;
  notifyJuniorFlic?: boolean;
  notifySeniorFlic?: boolean;
  notifyIntern?: boolean;
  notifyBCWorkingAttorney?: boolean;
}

export const useEmailSettings = () => {
  return useQuery({
    queryKey: ['email-settings'],
    queryFn: async () => {
      const response = await api.get<EmailSettings>('/email-settings');
      return response.data;
    },
  });
};

export const useUpdateEmailSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateEmailSettingsPayload) => {
      const response = await api.patch<EmailSettings>('/email-settings', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
    },
  });
};
