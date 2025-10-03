import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { toast } from '../lib/toast';
import type { ProjectAssignment } from '../types';

interface CreateAssignmentInput {
  projectId: number;
  staffId: number;
  roleInProject: string;
  jurisdiction?: string;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string;
}

interface UpdateAssignmentInput {
  id: number;
  data: {
    roleInProject?: string;
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
    onError: (error: any) => {
      toast.error('Failed to add team member', error.response?.data?.error || 'Please try again');
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
    onError: (error: any) => {
      toast.error('Failed to update team member', error.response?.data?.error || 'Please try again');
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
    onError: (error: any) => {
      toast.error('Failed to remove team member', error.response?.data?.error || 'Please try again');
    },
  });
};
