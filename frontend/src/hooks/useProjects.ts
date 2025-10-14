import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import api from '../api/client';
import type { Project } from '../types';
import { toast } from '../lib/toast';

interface ProjectsParams {
  status?: string;
  category?: string;
  search?: string;
  limit?: number;
}

interface ProjectsResponse {
  data: Project[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const useProjects = (params: ProjectsParams = {}) => {
  return useQuery({
    queryKey: ['projects', params],
    queryFn: async () => {
      const response = await api.get<ProjectsResponse>('/projects', { params });
      return response.data;
    },
  });
};

export const useProject = (id: string | number) => {
  return useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const response = await api.get<Project>(`/projects/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Project>) => {
      const response = await api.post<Project>('/projects', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Project created', 'The project has been created successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to create project', extractProjectError(error, 'Please try again'));
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Project> }) => {
      const response = await api.put<Project>(`/projects/${id}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Project updated', 'The project has been updated successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to update project', extractProjectError(error, 'Please try again'));
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Project deleted', 'The project has been deleted successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to delete project', extractProjectError(error, 'Please try again'));
    },
  });
};

export const useConfirmProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await api.post<{ message: string; project: Project }>(`/projects/${id}/confirm`);
      return response.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects-needing-attention'] });
      toast.success('Project confirmed', 'Project details have been confirmed');
    },
    onError: (error: unknown) => {
      toast.error('Failed to confirm project', extractProjectError(error, 'Please try again'));
    },
  });
};

const extractProjectError = (error: unknown, fallback: string): string => {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }
  return fallback;
};

interface ProjectsNeedingAttentionResponse {
  needsAttention: (Project & { attentionReasons: string[]; urgencyScore: number })[];
  allGood: Project[];
  summary: {
    totalProjects: number;
    needingAttention: number;
    allGood: number;
  };
}

export const useProjectsNeedingAttention = () => {
  return useQuery({
    queryKey: ['projects-needing-attention'],
    queryFn: async () => {
      const response = await api.get<ProjectsNeedingAttentionResponse>('/projects/needing-attention');
      return response.data;
    },
    staleTime: 60000, // 1 minute
  });
};
