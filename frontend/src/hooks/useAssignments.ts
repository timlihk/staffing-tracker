import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import api from '../api/client';
import { toast } from '../lib/toast';
import type { ProjectAssignment } from '../types';

interface CreateAssignmentInput {
  projectId: number;
  staffId: number;
  jurisdiction?: string;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string;
}

interface UpdateAssignmentInput {
  id: number;
  data: {
    jurisdiction?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    notes?: string | null;
  };
}

interface DeleteAssignmentInput {
  id: number;
  projectId: number;
  staffId: number;
}

export const useCreateAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateAssignmentInput) => {
      const response = await api.post<ProjectAssignment>('/assignments', payload);
      return response.data;
    },
    onSuccess: (assignment) => {
      queryClient.invalidateQueries({ queryKey: ['project', assignment.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['staff', assignment.staffId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Team member added', 'The staff member was assigned to the project.');
    },
    onError: (error: unknown) => {
      toast.error('Failed to add team member', extractErrorMessage(error, 'Please try again'));
    },
  });
};

export const useUpdateAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: UpdateAssignmentInput) => {
      const response = await api.put<ProjectAssignment>(`/assignments/${id}`, data);
      return response.data;
    },
    onSuccess: (assignment) => {
      queryClient.invalidateQueries({ queryKey: ['project', assignment.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['staff', assignment.staffId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Team member updated', 'Assignment details were updated successfully.');
    },
    onError: (error: unknown) => {
      toast.error('Failed to update team member', extractErrorMessage(error, 'Please try again'));
    },
  });
};

export const useDeleteAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, projectId, staffId }: DeleteAssignmentInput) => {
      await api.delete(`/assignments/${id}`);
      return { projectId, staffId };
    },
    onSuccess: ({ projectId, staffId }) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['staff', staffId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Team member removed', 'The staff member was removed from the project.');
    },
    onError: (error: unknown) => {
      toast.error('Failed to remove team member', extractErrorMessage(error, 'Please try again'));
    },
  });
};

const extractErrorMessage = (error: unknown, fallback: string): string => {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }
  return fallback;
};
