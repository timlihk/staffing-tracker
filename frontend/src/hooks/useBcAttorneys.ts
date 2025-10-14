import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import api from '../api/client';
import { toast } from '../lib/toast';

export const useAddBcAttorney = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, staffId }: { projectId: number; staffId: number }) => {
      const response = await api.post(`/projects/${projectId}/bc-attorneys`, { staffId });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('B&C Attorney added', 'The B&C attorney has been added successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to add B&C attorney', extractBcAttorneyError(error, 'Please try again'));
    },
  });
};

export const useRemoveBcAttorney = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, staffId }: { projectId: number; staffId: number }) => {
      const response = await api.delete(`/projects/${projectId}/bc-attorneys/${staffId}`);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('B&C Attorney removed', 'The B&C attorney has been removed successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to remove B&C attorney', extractBcAttorneyError(error, 'Please try again'));
    },
  });
};

const extractBcAttorneyError = (error: unknown, fallback: string): string => {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }
  return fallback;
};